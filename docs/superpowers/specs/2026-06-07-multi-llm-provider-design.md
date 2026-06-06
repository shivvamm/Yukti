# Multi-LLM Provider Support — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan
**Scope:** `server/` only (plus small extension cleanup)

## Goal

Make the server's LLM layer provider-agnostic so the operator can switch between Google Gemini, OpenAI, Groq, and Mistral by editing `.env` and restarting. Today every agent hard-codes `ChatGoogleGenerativeAI`; this design factors that out behind a small factory.

## Decisions (pinned during brainstorming)

| Question | Decision |
|---|---|
| Who picks the provider? | **Server operator** via `.env`. No client choice. |
| One provider for all agents, or per-agent? | **One shared provider.** Per-agent *model name* is still configurable. |
| Client-side API key field in extension? | **Remove it.** Drop the popup field and the `X-Gemini-API-Key` header. Server holds the only key. |
| V1 providers? | Gemini, OpenAI, Groq, Mistral. |
| Startup behavior if active provider's key is missing? | **Hard-fail** at startup with a clear error pointing at the env var to set. |
| Test infra? | Minimal — three seam-targeted factory tests. No broader test framework setup as part of this work. |

## Approach: LangChain `init_chat_model` + thin factory wrapper

LangChain ships a built-in dispatcher `init_chat_model(model, model_provider=..., api_key=..., temperature=..., max_tokens=...)` that returns a `BaseChatModel` for any supported provider. The agents already call `.invoke([SystemMessage, HumanMessage])` — that interface works on any `BaseChatModel`, so the agent bodies don't change. We wrap `init_chat_model` in our own `get_llm(role)` so the agents stay decoupled from the provider library.

**Why not a custom registry from scratch (Approach B):** duplicates what `init_chat_model` already does.
**Why not LiteLLM (Approach C):** would force a rewrite of every agent's `[SystemMessage, HumanMessage]` → `.invoke()` call and break LangGraph's chat-model integration. Same end-state, more risk.

## File layout

```
server/
  llm/
    __init__.py
    factory.py          # NEW — get_llm(role) → BaseChatModel
    providers.py        # NEW — ProviderSpec registry
  config/
    settings.py         # MODIFIED — llm_provider, per-provider keys, hard-fail validation
  agents/
    context_builder.py  # MODIFIED — drop ChatGoogleGenerativeAI; call get_llm("context_builder")
    analyzer.py         # MODIFIED — same
    suggestion.py       # MODIFIED — same
  api/
    routes.py           # MODIFIED — remove X-Gemini-API-Key header + os.environ mutation
  tests/
    __init__.py         # NEW
    test_llm_factory.py # NEW — three seam tests
yukti/
  popup.tsx             # MODIFIED — remove API key input field (lines 419-451)
  background.ts         # MODIFIED — remove X-Gemini-API-Key header send (lines 217, 258-263)
```

Boundary rationale:
- `llm/providers.py` — registry only. Maps our provider keys to the LangChain `model_provider` string, the settings attribute holding the API key, and the pip package name. This is the *one place* to add a new provider.
- `llm/factory.py` — single public function `get_llm(role)`. Reads `settings`, looks up the active provider spec, returns a cached `BaseChatModel`.
- Agents — never import a provider library; only `from llm.factory import get_llm`.

## Component details

### `server/llm/providers.py`

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class ProviderSpec:
    lc_name: str        # value passed to init_chat_model(model_provider=...)
    key_attr: str       # attribute on `settings` holding the API key
    pkg: str            # pip package name (for error messages)

PROVIDERS: dict[str, ProviderSpec] = {
    "gemini":  ProviderSpec(lc_name="google_genai", key_attr="google_api_key",  pkg="langchain-google-genai"),
    "openai":  ProviderSpec(lc_name="openai",       key_attr="openai_api_key",  pkg="langchain-openai"),
    "groq":    ProviderSpec(lc_name="groq",         key_attr="groq_api_key",    pkg="langchain-groq"),
    "mistral": ProviderSpec(lc_name="mistralai",    key_attr="mistral_api_key", pkg="langchain-mistralai"),
}
```

### `server/llm/factory.py`

```python
from functools import lru_cache
from typing import Literal
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from config.settings import settings
from llm.providers import PROVIDERS

Role = Literal["context_builder", "analyzer", "suggestion"]

ROLE_CONFIG: dict[Role, tuple[str, float, int]] = {
    "context_builder": ("context_builder_model", 0.3, 4096),
    "analyzer":        ("analyzer_model",        0.4, 4096),
    "suggestion":      ("suggestion_model",      0.7, 2048),
}

@lru_cache(maxsize=8)
def get_llm(role: Role) -> BaseChatModel:
    spec = PROVIDERS[settings.llm_provider]
    model_attr, temperature, max_tokens = ROLE_CONFIG[role]
    return init_chat_model(
        model=getattr(settings, model_attr),
        model_provider=spec.lc_name,
        api_key=getattr(settings, spec.key_attr),
        temperature=temperature,
        max_tokens=max_tokens,
    )
```

`lru_cache` ensures one LLM per role for the process lifetime. Provider selection is frozen at server startup (agents are module-level singletons that call `get_llm` in their `__init__`); switching providers requires a restart, which matches the design intent ("edit `.env`, restart").

This also incidentally clarifies a latent bug in the current code: the `X-Gemini-API-Key` override in `routes.py:55-58` mutates `settings.google_api_key` per request, but the agents' Gemini clients were already constructed at import time, so the mutation never reaches them. Removing that header path (separate change in `routes.py`, see below) makes the dead-code nature of that override explicit.

### `server/config/settings.py` changes

Add fields:
```python
llm_provider: Literal["gemini", "openai", "groq", "mistral"] = "gemini"
openai_api_key:  str = ""
groq_api_key:    str = ""
mistral_api_key: str = ""
# google_api_key stays
```

Per-role model fields (`context_builder_model`, `analyzer_model`, `suggestion_model`) stay but their *meaning* changes — they are now the model name for the active provider, not Gemini-specific.

`validate_settings()` upgrades:
- Raise `ValueError` if `llm_provider` is not in the supported set
- Raise `ValueError` if the API key matching `llm_provider` is empty, with the exact env-var name and a link to where to get a key
- Raise `ImportError` if the active provider's pip package isn't importable, with the `pip install <pkg>` hint
- Soft-warn (don't raise) if the *other* providers' keys are empty — they're optional

### Agent changes (3 lines each)

```diff
- from langchain_google_genai import ChatGoogleGenerativeAI
+ from llm.factory import get_llm

  class ContextBuilderAgent:
      def __init__(self):
-         self.llm = ChatGoogleGenerativeAI(google_api_key=settings.google_api_key, model=settings.context_builder_model, temperature=0.3, max_tokens=4096)
+         self.llm = get_llm("context_builder")
```

System messages, prompts, JSON parsing, error handling — all untouched.

### `server/api/routes.py` changes

Remove:
- `x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")` parameter
- The `if x_gemini_api_key:` block at lines 55-58 (`os.environ` mutation + `settings.google_api_key` mutation)
- The `import os` if no longer used elsewhere in this file

Removing this also fixes the concurrency hazard where one request's key could leak into another's.

### Extension changes

`yukti/popup.tsx` — delete the API key input field (lines 419-451) and any related state/storage handlers.

`yukti/background.ts` — delete the `X-Gemini-API-Key` header from the `/api/analyze` fetch (lines 217, 258-263).

### `requirements.txt` additions

```
langchain-openai==<latest compatible with langchain 0.3.7>
langchain-groq==<latest compatible with langchain 0.3.7>
langchain-mistralai==<latest compatible with langchain 0.3.7>
```

`langchain-google-genai` is already pinned. Versions to be resolved during implementation against the existing `langchain==0.3.7` / `langchain-core==0.3.15` pins.

## Configuration: `.env` shape

```bash
# Provider selection — one of: gemini | openai | groq | mistral
LLM_PROVIDER=gemini

# Provider API keys (set the one matching LLM_PROVIDER)
GOOGLE_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=

# Per-role model names (use names valid for the active provider)
CONTEXT_BUILDER_MODEL=gemini-2.5-flash
ANALYZER_MODEL=gemini-2.5-pro
SUGGESTION_MODEL=gemini-2.5-pro
```

A `.env.example` should be shipped with the above keys plus commented-out sample model names for each provider.

Switching providers = edit `.env` + restart server. Example switch to Groq:

```diff
- LLM_PROVIDER=gemini
- CONTEXT_BUILDER_MODEL=gemini-2.5-flash
- ANALYZER_MODEL=gemini-2.5-pro
- SUGGESTION_MODEL=gemini-2.5-pro
+ LLM_PROVIDER=groq
+ CONTEXT_BUILDER_MODEL=llama-3.1-8b-instant
+ ANALYZER_MODEL=llama-3.3-70b-versatile
+ SUGGESTION_MODEL=llama-3.3-70b-versatile
```

## Data flow

Unchanged from the outside. The factory is invisible to the API surface.

```
POST /api/analyze
  → workflow.ainvoke(state)
    → context_builder.build_context(state)
        llm = get_llm("context_builder")   # cached BaseChatModel
        llm.invoke([SystemMessage, HumanMessage])
    → analyzer.analyze(state)
        llm = get_llm("analyzer")
        llm.invoke(...)
    → suggestion.suggest(state)
        llm = get_llm("suggestion")
        llm.invoke(...)
  → response
```

## Error handling

Three layers, each owned by the right place.

**1. Startup validation** — `settings.py` `validate_settings()`:
- Unknown `llm_provider` → `ValueError` listing the four valid values
- Active provider's API key empty → `ValueError` naming the env var and link to obtain a key
- Active provider's pip package not importable → `ImportError` with `pip install <pkg>` hint
- Server fails to start. Better than failing on first request.

**2. Per-request LLM errors** — unchanged. Each agent already wraps `self.llm.invoke(...)` in `try/except Exception` and falls back to `_get_default_*()` results (`context_builder.py:57-68`, `analyzer.py:58-70`, `suggestion.py:71-84`). That behavior is preserved verbatim.

**3. Factory errors:**
- `get_llm("bad_role")` → `KeyError` listing valid roles. Programming bug; should crash loudly in dev.
- `init_chat_model` failures (e.g. invalid model name for the chosen provider) → propagate up to the agent's existing `try/except`, which falls back to default output. The endpoint still returns 200 with empty suggestions — same behavior as today when the LLM returns garbage.

**Out of scope:** retries, rate-limit handling, provider fallback chains ("if Groq fails, try OpenAI"). If wanted, that's a separate design.

## Testing

Minimal — three seam-targeted tests against the factory. No broader test framework setup as part of this work.

Add `pytest` to a new `requirements-dev.txt` (or a `[dev]` extras group), and `server/tests/test_llm_factory.py`:

```python
import pytest
from langchain_core.language_models import BaseChatModel
from llm.factory import get_llm
from llm.providers import PROVIDERS
from config.settings import settings, validate_settings

def test_get_llm_returns_chat_model_for_each_provider(monkeypatch):
    for provider in ("gemini", "openai", "groq", "mistral"):
        monkeypatch.setattr(settings, "llm_provider", provider)
        monkeypatch.setattr(settings, PROVIDERS[provider].key_attr, "test-key")
        get_llm.cache_clear()
        llm = get_llm("context_builder")
        assert isinstance(llm, BaseChatModel)

def test_get_llm_invalid_role_raises():
    with pytest.raises(KeyError):
        get_llm("not_a_role")  # type: ignore[arg-type]

def test_settings_validate_rejects_unknown_provider(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    with pytest.raises(ValueError, match="LLM_PROVIDER"):
        validate_settings()
```

**Not tested** (and why):
- Agent behavior — unchanged, no existing tests, out of scope
- Real LLM network calls — slow, cost money, flaky. The factory's contract ends at "returns a `BaseChatModel`"
- Extension changes — no Plasmo/React test setup exists

**Manual smoke test** (run after implementation):
1. `LLM_PROVIDER=gemini` in `.env`, run server, hit `/api/analyze` with a fixture payload → suggestions returned
2. Swap to `LLM_PROVIDER=groq` + Groq model names + `GROQ_API_KEY`, restart, same payload → suggestions returned
3. Reload extension, confirm the Gemini-key field is gone from the popup, confirm `/api/analyze` still works with no key header sent

## Out of scope

- Per-agent provider selection (different provider for each of the 3 agents)
- Client-side provider selection (extension UI picks the provider)
- Runtime hot-swap without server restart
- Provider fallback chains
- Streaming responses (none today)
- Standing up CI / broader test infrastructure
- Updating `INTEGRATION_GUIDE.md` (stale already — separate cleanup)

## Open items for the implementation plan

- Resolve compatible version pins for `langchain-openai`, `langchain-groq`, `langchain-mistralai` against `langchain==0.3.7` / `langchain-core==0.3.15`
- Confirm the LangChain `init_chat_model` API in version 0.3.7 accepts `api_key=` for all four providers (vs. requiring env vars). If any provider only honors env vars, the factory sets `os.environ[<KEY>] = ...` at module load time (one-shot, before the LLM is built — no per-request mutation)
- Whether to ship `.env.example` or document defaults in `server/README.md`
