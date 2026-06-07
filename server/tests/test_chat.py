from dataclasses import dataclass
from rag.chat import answer, ChatAnswer
from rag.pinecone_client import QueryHit
import rag.chat as chat_module


class FakeLLM:
    def __init__(self, response_text="The answer"):
        self.response_text = response_text
        self.last_messages = None

    def invoke(self, messages):
        self.last_messages = messages
        return type("R", (), {"content": self.response_text})()


def _hit(id_, text, url="https://example.com", ts=1717764493000):
    return QueryHit(id=id_, score=0.9, values_text=text,
                    metadata={"url": url, "timestamp": ts,
                              "tab_title": "Example", "type": "click"})


def test_answer_returns_chat_answer_with_text(monkeypatch):
    fake = FakeLLM(response_text="Hello there.")
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    result = answer(question="hi?", current_url="https://x", current_page_text="",
                    chat_history=[], retrieved=[])
    assert isinstance(result, ChatAnswer)
    assert result.answer == "Hello there."
    assert result.sources == []


def test_answer_includes_current_page_in_prompt(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    answer(question="what page?", current_url="https://workatastartup.com",
           current_page_text="WELCOME TO WORKATASTARTUP", chat_history=[], retrieved=[])
    prompt = _last_user_prompt(fake)
    assert "WELCOME TO WORKATASTARTUP" in prompt
    assert "workatastartup.com" in prompt


def test_answer_includes_retrieved_context_in_prompt(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    answer(question="yesterday?", current_url="", current_page_text="", chat_history=[],
           retrieved=[
               _hit("a", "Visited Hacker News at news.ycombinator.com (Sun Jun 6 2026, 09:00)"),
               _hit("b", "Clicked 'Apply' on workatastartup.com (Sat Jun 6 2026, 14:00)"),
           ])
    prompt = _last_user_prompt(fake)
    assert "Hacker News" in prompt
    assert "workatastartup.com" in prompt
    assert "[YOUR BROWSING HISTORY" in prompt


def test_answer_returns_sources_from_retrieved(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    result = answer(question="?", current_url="", current_page_text="", chat_history=[],
                    retrieved=[_hit("a", "snippet text", url="https://news.ycombinator.com/")])
    assert len(result.sources) == 1
    assert result.sources[0].url == "https://news.ycombinator.com/"
    assert result.sources[0].snippet.startswith("snippet text")


def test_answer_includes_chat_history(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    answer(question="follow up", current_url="", current_page_text="",
           chat_history=[
               {"role": "user", "content": "what's a startup?"},
               {"role": "assistant", "content": "A small company."},
           ],
           retrieved=[])
    prompt = _last_user_prompt(fake)
    assert "what's a startup?" in prompt
    assert "A small company." in prompt


def test_answer_handles_empty_retrieved_gracefully(monkeypatch):
    fake = FakeLLM(response_text="Sure.")
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    result = answer(question="?", current_url="", current_page_text="",
                    chat_history=[], retrieved=[])
    assert result.answer == "Sure."
    assert result.sources == []


def _last_user_prompt(fake: FakeLLM) -> str:
    """Pull the user message content out of the last invoke() call."""
    msgs = fake.last_messages
    assert msgs is not None
    for m in msgs:
        content = getattr(m, "content", str(m))
        if isinstance(content, str) and "[QUESTION]" in content:
            return content
    return ""
