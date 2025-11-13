import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Groq API Configuration
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")

    # Model Configuration
    analyzer_model: str = os.getenv("ANALYZER_MODEL", "llama-3.1-8b-instant")
    predictor_model: str = os.getenv("PREDICTOR_MODEL", "llama-3.1-8b-instant")
    suggestion_model: str = os.getenv("SUGGESTION_MODEL", "llama-3.1-70b-versatile")
    action_model: str = os.getenv("ACTION_MODEL", "llama-3.1-70b-versatile")
    supervisor_model: str = os.getenv("SUPERVISOR_MODEL", "llama-3.1-70b-versatile")

    # Model Parameters
    temperature: float = float(os.getenv("TEMPERATURE", "0.7"))
    max_tokens: int = int(os.getenv("MAX_TOKENS", "1024"))

    # Server Configuration
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "True").lower() == "true"

    # CORS Settings
    allowed_origins: List[str] = os.getenv(
        "ALLOWED_ORIGINS",
        "chrome-extension://*,http://localhost:3000,http://localhost:8000"
    ).split(",")

    # Batch Processing
    batch_size: int = int(os.getenv("BATCH_SIZE", "50"))
    analysis_threshold: int = int(os.getenv("ANALYSIS_THRESHOLD", "20"))

    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()


# Validate settings on import
def validate_settings():
    """Validate critical settings"""
    if not settings.groq_api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. Please set it in your .env file or environment variables."
        )

    print(f"✅ Settings loaded successfully")
    print(f"   - Analyzer Model: {settings.analyzer_model}")
    print(f"   - Supervisor Model: {settings.supervisor_model}")
    print(f"   - Server: {settings.host}:{settings.port}")
    print(f"   - Debug Mode: {settings.debug}")


# Run validation when module is imported
try:
    validate_settings()
except ValueError as e:
    print(f"⚠️  Warning: {e}")
