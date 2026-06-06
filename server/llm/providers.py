from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderSpec:
    """Static metadata about a supported LLM provider."""

    lc_name: str   # provider string accepted by langchain.chat_models.init_chat_model
    key_attr: str  # attribute on `settings` holding the API key
    env_var: str   # OS env var name the underlying SDK reads
    pkg: str       # pip package name (used in error messages)


PROVIDERS: dict[str, ProviderSpec] = {
    "gemini":  ProviderSpec(lc_name="google_genai", key_attr="google_api_key",  env_var="GOOGLE_API_KEY",  pkg="langchain-google-genai"),
    "openai":  ProviderSpec(lc_name="openai",       key_attr="openai_api_key",  env_var="OPENAI_API_KEY",  pkg="langchain-openai"),
    "groq":    ProviderSpec(lc_name="groq",         key_attr="groq_api_key",    env_var="GROQ_API_KEY",    pkg="langchain-groq"),
    "mistral": ProviderSpec(lc_name="mistralai",    key_attr="mistral_api_key", env_var="MISTRAL_API_KEY", pkg="langchain-mistralai"),
}
