from config.settings import Settings


def test_settings_has_llm_provider_default_gemini():
    s = Settings(google_api_key="x")
    assert s.llm_provider == "gemini"


def test_settings_has_all_provider_key_fields():
    s = Settings()
    assert hasattr(s, "google_api_key")
    assert hasattr(s, "openai_api_key")
    assert hasattr(s, "groq_api_key")
    assert hasattr(s, "mistral_api_key")


def test_settings_has_pinecone_fields():
    s = Settings()
    assert hasattr(s, "pinecone_api_key")
    assert s.pinecone_index_name == "yukti-interactions"
    assert s.pinecone_embed_model == "multilingual-e5-large"
    assert s.pinecone_cloud == "aws"
    assert s.pinecone_region == "us-east-1"


def test_settings_has_chat_model_field():
    s = Settings()
    assert hasattr(s, "chat_model")
    assert s.chat_model  # non-empty default


def test_settings_no_longer_has_agent_model_fields():
    s = Settings()
    assert not hasattr(s, "context_builder_model")
    assert not hasattr(s, "analyzer_model")
    assert not hasattr(s, "suggestion_model")


def test_settings_rejects_unknown_provider_at_construction():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Settings(llm_provider="anthropic")
