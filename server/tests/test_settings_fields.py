from config.settings import Settings


def test_settings_has_llm_provider_default_gemini():
    s = Settings(google_api_key="x")  # constructor accepts overrides
    assert s.llm_provider == "gemini"


def test_settings_has_all_provider_key_fields():
    s = Settings()
    assert hasattr(s, "google_api_key")
    assert hasattr(s, "openai_api_key")
    assert hasattr(s, "groq_api_key")
    assert hasattr(s, "mistral_api_key")


def test_settings_rejects_unknown_provider_at_construction():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Settings(llm_provider="anthropic")
