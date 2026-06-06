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


def test_lc_names_match_langchain_provider_strings():
    assert PROVIDERS["gemini"].lc_name == "google_genai"
    assert PROVIDERS["openai"].lc_name == "openai"
    assert PROVIDERS["groq"].lc_name == "groq"
    assert PROVIDERS["mistral"].lc_name == "mistralai"
