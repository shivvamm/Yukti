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

    # Model Configuration (Gemini 2.5 models) - New 3-Agent Architecture
    context_builder_model: str = "gemini-2.5-flash"  # Fast context extraction
    analyzer_model: str = "gemini-2.5-pro"  # Deep intent analysis
    suggestion_model: str = "gemini-2.5-pro"  # Actionable suggestions

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


# Validate settings on import
def validate_settings():
    """Validate critical settings"""
    if not settings.google_api_key:
        raise ValueError(
            "GOOGLE_API_KEY is not set. Please set it in your .env file or environment variables.\n"
            "Get your API key from: https://ai.google.dev/gemini-api/docs/api-key"
        )

    print(f"✅ Settings loaded successfully")
    print(f"   - Context Builder: {settings.context_builder_model}")
    print(f"   - Intent Analyzer: {settings.analyzer_model}")
    print(f"   - Suggestion: {settings.suggestion_model}")
    print(f"   - Server: {settings.host}:{settings.port}")
    print(f"   - Debug Mode: {settings.debug}")


# Run validation when module is imported
try:
    validate_settings()
except ValueError as e:
    print(f"⚠️  Warning: {e}")
