import pytest
from langchain_core.language_models import BaseChatModel
from config.settings import settings
from llm.factory import get_llm
from llm.providers import PROVIDERS


@pytest.mark.parametrize("provider", ["gemini", "openai", "groq", "mistral"])
def test_get_llm_returns_chat_model_for_each_provider(monkeypatch, provider):
    monkeypatch.setattr(settings, "llm_provider", provider)
    monkeypatch.setattr(settings, PROVIDERS[provider].key_attr, "test-key-value")
    get_llm.cache_clear()
    llm = get_llm("chat")
    assert isinstance(llm, BaseChatModel)


def test_get_llm_invalid_role_raises(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    with pytest.raises(KeyError):
        get_llm("not_a_role")  # type: ignore[arg-type]


def test_get_llm_caches_per_role(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    a = get_llm("chat")
    b = get_llm("chat")
    assert a is b


def test_get_llm_rejects_old_agent_roles(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    for old_role in ("context_builder", "analyzer", "suggestion"):
        with pytest.raises(KeyError):
            get_llm(old_role)  # type: ignore[arg-type]
