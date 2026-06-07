"""Assemble RAG prompts and call the LLM.

The prompt has four parts:
  - the live current page DOM text (for "what's on this tab" questions)
  - top-K retrieved interactions (for historical questions)
  - the last N turns of conversation (for multi-turn coherence)
  - the user's question

Returns the answer plus structured sources for the UI to render.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from llm.factory import get_llm
from rag.pinecone_client import QueryHit


@dataclass(frozen=True)
class Source:
    url: str
    timestamp: int
    snippet: str


@dataclass(frozen=True)
class ChatAnswer:
    answer: str
    sources: list[Source]


SYSTEM_PROMPT = (
    "You are Yukti, a personal browser-history assistant. "
    "Answer the user's question based on the live page they are viewing "
    "and the relevant interactions retrieved from their browsing history. "
    "Cite URLs when relevant. If you don't have evidence in the provided "
    "context, say so plainly — never fabricate."
)


def answer(
    *,
    question: str,
    current_url: str,
    current_page_text: str,
    chat_history: list[dict[str, str]],
    retrieved: list[QueryHit],
) -> ChatAnswer:
    """Run a chat turn. Returns the answer + sources for the UI."""
    user_prompt = _build_user_prompt(question, current_url, current_page_text,
                                     chat_history, retrieved)
    llm = get_llm("chat")
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])
    answer_text = response.content if isinstance(response.content, str) else str(response.content)
    sources = [_hit_to_source(h) for h in retrieved]
    return ChatAnswer(answer=answer_text, sources=sources)


def _build_user_prompt(
    question: str,
    current_url: str,
    current_page_text: str,
    chat_history: list[dict[str, str]],
    retrieved: list[QueryHit],
) -> str:
    parts = []
    parts.append(f"[CURRENT PAGE: {current_url or 'none'}]")
    parts.append((current_page_text or "(no page content)")[:3000])
    parts.append("")
    parts.append("[YOUR BROWSING HISTORY — relevant interactions]")
    if retrieved:
        for h in retrieved:
            ts = h.metadata.get("timestamp", 0)
            when = _format_ts(ts) if ts else ""
            parts.append(f"- {when}: {h.values_text}")
    else:
        parts.append("(no relevant interactions found)")
    parts.append("")
    parts.append("[CONVERSATION SO FAR]")
    if chat_history:
        for turn in chat_history:
            role = turn.get("role", "user").upper()
            content = turn.get("content", "")
            parts.append(f"{role}: {content}")
    else:
        parts.append("(this is the first turn)")
    parts.append("")
    parts.append("[QUESTION]")
    parts.append(question)
    return "\n".join(parts)


def _hit_to_source(h: QueryHit) -> Source:
    snippet = h.values_text[:80]
    if len(h.values_text) > 80:
        snippet += "..."
    return Source(
        url=h.metadata.get("url", "") or "",
        timestamp=int(h.metadata.get("timestamp", 0) or 0),
        snippet=snippet,
    )


def _format_ts(ms: int) -> str:
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%a %b %-d %Y, %H:%M")
