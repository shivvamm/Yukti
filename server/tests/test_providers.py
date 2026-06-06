from llm.providers import PROVIDERS, ProviderSpec


def test_registry_contains_all_four_providers():
    assert set(PROVIDERS.keys()) == {"gemini", "openai", "groq", "mistral"}


def test_each_spec_has_required_fields():
    for name, spec in PROVIDERS.items():
        assert isinstance(spec, ProviderSpec)
        assert spec.lc_name, f"{name} missing lc_name"
        assert spec.key_attr, f"{name} missing key_attr"
        assert spec.env_var, f"{name} missing env_var"
        assert spec.pkg, f"{name} missing pkg"


def test_all_spec_values_match_expected():
    expected = {
        "gemini":  ProviderSpec(lc_name="google_genai", key_attr="google_api_key",  env_var="GOOGLE_API_KEY",  pkg="langchain-google-genai"),
        "openai":  ProviderSpec(lc_name="openai",       key_attr="openai_api_key",  env_var="OPENAI_API_KEY",  pkg="langchain-openai"),
        "groq":    ProviderSpec(lc_name="groq",         key_attr="groq_api_key",    env_var="GROQ_API_KEY",    pkg="langchain-groq"),
        "mistral": ProviderSpec(lc_name="mistralai",    key_attr="mistral_api_key", env_var="MISTRAL_API_KEY", pkg="langchain-mistralai"),
    }
    assert PROVIDERS == expected
