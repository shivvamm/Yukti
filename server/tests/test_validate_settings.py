import pytest
from config.settings import Settings, settings, validate_settings
from llm.providers import PROVIDERS


def test_validate_raises_when_active_provider_key_missing(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        validate_settings()


def test_validate_passes_when_active_provider_key_present(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "gsk_test")
    validate_settings()  # must not raise


def test_validate_does_not_require_inactive_providers(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "AIzaTest")
    monkeypatch.setattr(settings, "openai_api_key", "")  # inactive
    monkeypatch.setattr(settings, "groq_api_key", "")    # inactive
    monkeypatch.setattr(settings, "mistral_api_key", "") # inactive
    validate_settings()  # must not raise


def test_validate_raises_when_pinecone_key_missing(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "AIzaTest")
    monkeypatch.setattr(settings, "pinecone_api_key", "")
    with pytest.raises(ValueError, match="PINECONE_API_KEY"):
        validate_settings()


def test_validate_passes_with_both_provider_and_pinecone_keys(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "AIzaTest")
    monkeypatch.setattr(settings, "pinecone_api_key", "pc_test_key")
    validate_settings()  # must not raise
