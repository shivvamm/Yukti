import os
from functools import lru_cache
from typing import Literal

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from config.settings import settings
from llm.providers import PROVIDERS

Role = Literal["context_builder", "analyzer", "suggestion"]

# (settings_model_attr, temperature, max_tokens) — preserves existing per-agent tuning
ROLE_CONFIG: dict[str, tuple[str, float, int]] = {
    "context_builder": ("context_builder_model", 0.3, 4096),
    "analyzer":        ("analyzer_model",        0.4, 4096),
    "suggestion":      ("suggestion_model",      0.7, 2048),
}


@lru_cache(maxsize=8)
def get_llm(role: Role) -> BaseChatModel:
    """Return a cached BaseChatModel for the given agent role.

    Provider is read from settings.llm_provider. Cache is per-role; the
    underlying provider/key/model is frozen at first call. Restart the
    server (or call get_llm.cache_clear()) to pick up .env changes.
    """
    spec = PROVIDERS[settings.llm_provider]
    model_attr, temperature, max_tokens = ROLE_CONFIG[role]

    # Set the env var the underlying SDK reads. Safe to do here: this
    # function is called once per role at startup and cached after.
    api_key = getattr(settings, spec.key_attr)
    if api_key:
        os.environ[spec.env_var] = api_key

    return init_chat_model(
        model=getattr(settings, model_attr),
        model_provider=spec.lc_name,
        temperature=temperature,
        max_tokens=max_tokens,
    )
