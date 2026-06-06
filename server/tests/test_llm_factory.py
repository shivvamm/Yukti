import pytest
from langchain_core.language_models import BaseChatModel
from config.settings import settings
from llm.factory import get_llm
from llm.providers import PROVIDERS


@pytest.mark.parametrize("provider", ["gemini", "openai", "groq", "mistral"])
def test_get_llm_returns_chat_model_for_each_provider(monkeypatch, provider):
    """get_llm builds a BaseChatModel for every supported provider."""
    monkeypatch.setattr(settings, "llm_provider", provider)
    monkeypatch.setattr(settings, PROVIDERS[provider].key_attr, "test-key-value")
    get_llm.cache_clear()
    llm = get_llm("context_builder")
    assert isinstance(llm, BaseChatModel)


def test_get_llm_invalid_role_raises():
    get_llm.cache_clear()
    with pytest.raises(KeyError):
        get_llm("not_a_role")  # type: ignore[arg-type]


def test_get_llm_caches_per_role(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    a = get_llm("context_builder")
    b = get_llm("context_builder")
    assert a is b  # same cached instance
