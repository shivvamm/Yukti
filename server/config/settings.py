import os
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # LLM Provider Configuration
    llm_provider: Literal["gemini", "openai", "groq", "mistral"] = "gemini"

    # Provider API keys — set the one matching llm_provider
    google_api_key:  str = ""
    openai_api_key:  str = ""
    groq_api_key:    str = ""
    mistral_api_key: str = ""

    # Chat model (used by the single chat role in the LLM factory)
    chat_model: str = "gemini-2.5-pro"

    # Pinecone (RAG vector store with integrated embeddings)
    pinecone_api_key:     str = ""
    pinecone_index_name:  str = "yukti-interactions"
    pinecone_embed_model: str = "multilingual-e5-large"
    pinecone_cloud:       str = "aws"
    pinecone_region:      str = "us-east-1"

    # Model Parameters
    temperature: float = 0.7
    max_tokens: int = 8192

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS Settings (comma-separated string)
    allowed_origins: str = "*"

    # Batch Processing
    batch_size: int = 50
    analysis_threshold: int = 20

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"
    )

    def get_allowed_origins_list(self) -> List[str]:
        """Parse allowed_origins string into list"""
        if self.allowed_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.allowed_origins.split(",")]


# Global settings instance
settings = Settings()


def validate_settings():
    """Validate critical settings. Raises on misconfiguration."""
    # Import here to avoid a circular import at module load.
    from llm.providers import PROVIDERS

    if settings.llm_provider not in PROVIDERS:
        raise ValueError(
            f"LLM_PROVIDER='{settings.llm_provider}' is not supported. "
            f"Valid values: {sorted(PROVIDERS.keys())}"
        )

    spec = PROVIDERS[settings.llm_provider]
    active_key = getattr(settings, spec.key_attr)
    if not active_key:
        raise ValueError(
            f"{spec.env_var} is not set but LLM_PROVIDER={settings.llm_provider}. "
            f"Set {spec.env_var} in your .env file or environment."
        )

    # Verify the active provider's pip package is importable.
    try:
        __import__(spec.pkg.replace("-", "_"))
    except ImportError as e:
        raise ImportError(
            f"LLM_PROVIDER={settings.llm_provider} requires `{spec.pkg}`. "
            f"Install with: pip install {spec.pkg}"
        ) from e

    print(f"✅ Settings loaded successfully")
    print(f"   - Provider: {settings.llm_provider}")
    print(f"   - Chat model: {settings.chat_model}")
    print(f"   - Server: {settings.host}:{settings.port}")
    print(f"   - Debug Mode: {settings.debug}")


# Run validation when module is imported
validate_settings()
