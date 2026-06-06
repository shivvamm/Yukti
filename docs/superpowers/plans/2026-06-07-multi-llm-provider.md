# Multi-LLM Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server's LLM layer provider-agnostic — operator switches between Gemini, OpenAI, Groq, and Mistral by editing `.env` and restarting.

**Architecture:** Introduce `server/llm/` (a `providers.py` registry + a `factory.py` with `get_llm(role)`). Agents drop their hard-coded `ChatGoogleGenerativeAI` and call the factory. Provider is chosen via `LLM_PROVIDER` env var; the active provider's API key must be set or the server fails to start. Extension's per-user API-key field is removed since the server now owns the only key.

**Tech Stack:** Python 3.9+ / FastAPI 0.115.4 / pydantic-settings 2.6.1 / LangChain 0.3.7 (`init_chat_model`) / pytest (new) / TypeScript+React+Plasmo (extension).

**Spec:** `docs/superpowers/specs/2026-06-07-multi-llm-provider-design.md`

---

## Working directory

All commands assume CWD is the repo root unless prefixed with `cd server`.

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti
```

For server commands, use `cd server && <cmd>` or set `PYTHONPATH=server` so imports like `from llm.factory import get_llm` resolve. Existing imports in this project (e.g. `from config.settings import settings`) use the `server/` directory as the import root.

---

### Task 1: Add new dependencies

**Files:**
- Modify: `server/requirements.txt`
- Create: `server/requirements-dev.txt`

- [ ] **Step 1: Append provider packages to `server/requirements.txt`**

Open `server/requirements.txt` and add these three lines after the existing `langchain-google-genai==2.0.5` line:

```
langchain-openai==0.2.5
langchain-groq==0.2.1
langchain-mistralai==0.2.1
```

(These versions are compatible with `langchain==0.3.7` / `langchain-core==0.3.15`. If pip resolves a conflict, pick the highest 0.2.x of each that satisfies the existing pins.)

- [ ] **Step 2: Create `server/requirements-dev.txt`**

```
-r requirements.txt
pytest==8.3.3
```

- [ ] **Step 3: Install dev requirements and verify imports**

```bash
cd server && pip install -r requirements-dev.txt
```

Then verify each provider package imports cleanly:

```bash
cd server && python -c "from langchain_openai import ChatOpenAI; from langchain_groq import ChatGroq; from langchain_mistralai import ChatMistralAI; from langchain_google_genai import ChatGoogleGenerativeAI; from langchain.chat_models import init_chat_model; print('OK')"
```

Expected output: `OK`

If a provider import fails with a version conflict, downgrade just that package one minor version and retry until `pip install` succeeds and the import line prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add server/requirements.txt server/requirements-dev.txt
git commit -m "deps: add langchain-openai, langchain-groq, langchain-mistralai, pytest"
```

---

### Task 2: Create `server/llm/providers.py` (provider registry)

**Files:**
- Create: `server/llm/__init__.py` (empty)
- Create: `server/llm/providers.py`
- Create: `server/tests/__init__.py` (empty)
- Create: `server/tests/test_providers.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_providers.py`:

```python
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
    # init_chat_model expects these exact provider strings
    assert PROVIDERS["gemini"].lc_name == "google_genai"
    assert PROVIDERS["openai"].lc_name == "openai"
    assert PROVIDERS["groq"].lc_name == "groq"
    assert PROVIDERS["mistral"].lc_name == "mistralai"
```

Also create `server/tests/__init__.py` and `server/llm/__init__.py` as empty files (touch them).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && PYTHONPATH=. pytest tests/test_providers.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'llm.providers'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/llm/providers.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && PYTHONPATH=. pytest tests/test_providers.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add server/llm/__init__.py server/llm/providers.py server/tests/__init__.py server/tests/test_providers.py
git commit -m "feat(llm): add ProviderSpec registry for Gemini/OpenAI/Groq/Mistral"
```

---

### Task 3: Extend `settings.py` with `llm_provider` and per-provider keys

**Files:**
- Modify: `server/config/settings.py`
- Create: `server/tests/test_settings_fields.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_settings_fields.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && PYTHONPATH=. pytest tests/test_settings_fields.py -v
```

Expected: 2 fail with `AttributeError`, 1 fails because pydantic accepts the unknown value (no Literal).

- [ ] **Step 3: Modify `server/config/settings.py`**

Replace the imports block at the top so `Literal` is available, and add the new fields. Open `server/config/settings.py` and apply this diff:

```diff
 import os
-from typing import List
+from typing import List, Literal
 from pydantic_settings import BaseSettings, SettingsConfigDict
 from dotenv import load_dotenv

 load_dotenv()


 class Settings(BaseSettings):
     """Application settings loaded from environment variables"""

-    # Google Gemini API Configuration
-    google_api_key: str = ""
+    # LLM Provider Configuration
+    llm_provider: Literal["gemini", "openai", "groq", "mistral"] = "gemini"
+
+    # Provider API keys — set the one matching llm_provider
+    google_api_key:  str = ""
+    openai_api_key:  str = ""
+    groq_api_key:    str = ""
+    mistral_api_key: str = ""

     # Model Configuration (Gemini 2.5 models) - New 3-Agent Architecture
     context_builder_model: str = "gemini-2.5-flash"  # Fast context extraction
     analyzer_model: str = "gemini-2.5-pro"  # Deep intent analysis
     suggestion_model: str = "gemini-2.5-pro"  # Actionable suggestions
```

Leave `validate_settings()` alone for now — Task 5 upgrades it.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && PYTHONPATH=. pytest tests/test_settings_fields.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add server/config/settings.py server/tests/test_settings_fields.py
git commit -m "feat(settings): add llm_provider field and per-provider API keys"
```

---

### Task 4: Build `server/llm/factory.py` with `get_llm`

**Files:**
- Create: `server/llm/factory.py`
- Create: `server/tests/test_llm_factory.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_llm_factory.py`:

```python
import pytest
from langchain_core.language_models import BaseChatModel
from config.settings import settings
from llm.factory import get_llm
from llm.providers import PROVIDERS


@pytest.mark.parametrize("provider", ["gemini", "openai", "groq", "mistral"])
def test_get_llm_returns_chat_model_for_each_provider(monkeypatch, provider):
    """get_llm builds a BaseChatModel for every supported provider."""
    monkeypatch.setattr(settings, "llm_provider", provider)
    monkeypatch.setattr(settings, PROVIDERS[provider].key_attr, "test-key-value")
    get_llm.cache_clear()
    llm = get_llm("context_builder")
    assert isinstance(llm, BaseChatModel)


def test_get_llm_invalid_role_raises():
    get_llm.cache_clear()
    with pytest.raises(KeyError):
        get_llm("not_a_role")  # type: ignore[arg-type]


def test_get_llm_caches_per_role(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    a = get_llm("context_builder")
    b = get_llm("context_builder")
    assert a is b  # same cached instance
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && PYTHONPATH=. pytest tests/test_llm_factory.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'llm.factory'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/llm/factory.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && PYTHONPATH=. pytest tests/test_llm_factory.py -v
```

Expected: 6 passed (4 parametrized + 2 standalone).

If any provider's test fails with a TypeError about `max_tokens` not being a valid kwarg, the implementation needs the `max_tokens` keyword name remapped (some providers call it differently). Check the failing provider's chat-model class signature and adjust by passing the kwarg via `model_kwargs={"max_tokens": ...}` instead. Keep the test as the source of truth.

- [ ] **Step 5: Commit**

```bash
git add server/llm/factory.py server/tests/test_llm_factory.py
git commit -m "feat(llm): add get_llm factory dispatching by settings.llm_provider"
```

---

### Task 5: Upgrade `validate_settings()` to hard-fail on misconfiguration

**Files:**
- Modify: `server/config/settings.py`
- Create: `server/tests/test_validate_settings.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_validate_settings.py`:

```python
import pytest
from config.settings import Settings, settings, validate_settings
from llm.providers import PROVIDERS


def test_validate_raises_when_active_provider_key_missing(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        validate_settings()


def test_validate_passes_when_active_provider_key_present(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "gsk_test")
    validate_settings()  # must not raise


def test_validate_does_not_require_inactive_providers(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "AIzaTest")
    monkeypatch.setattr(settings, "openai_api_key", "")  # inactive
    monkeypatch.setattr(settings, "groq_api_key", "")    # inactive
    monkeypatch.setattr(settings, "mistral_api_key", "") # inactive
    validate_settings()  # must not raise
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && PYTHONPATH=. pytest tests/test_validate_settings.py -v
```

Expected: Some pass (default Gemini path still works), the first one fails because today's `validate_settings` only checks `google_api_key` regardless of provider.

- [ ] **Step 3: Rewrite `validate_settings()` in `server/config/settings.py`**

Replace the existing `validate_settings()` function (currently at the bottom of the file) with this version. Also remove the `try/except ValueError` at the very bottom that downgrades the validation error to a warning print — startup must fail loud now.

```python
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
    print(f"   - Context Builder: {settings.context_builder_model}")
    print(f"   - Intent Analyzer: {settings.analyzer_model}")
    print(f"   - Suggestion: {settings.suggestion_model}")
    print(f"   - Server: {settings.host}:{settings.port}")
    print(f"   - Debug Mode: {settings.debug}")


# Run validation when module is imported
validate_settings()
```

(Remove the previous `try/except ValueError as e: print(f"⚠️ Warning: {e}")` wrapper — let the ValueError propagate.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && PYTHONPATH=. GOOGLE_API_KEY=AIzaTest pytest tests/test_validate_settings.py -v
```

(The env var is needed because `validate_settings()` runs at module import time. Pytest's monkeypatch only affects the running test, not the import.)

Expected: 3 passed.

- [ ] **Step 5: Run the entire test suite to confirm nothing else regressed**

```bash
cd server && PYTHONPATH=. GOOGLE_API_KEY=AIzaTest pytest -v
```

Expected: all tests from Tasks 2-5 pass.

- [ ] **Step 6: Commit**

```bash
git add server/config/settings.py server/tests/test_validate_settings.py
git commit -m "feat(settings): hard-fail startup if active provider's key is missing"
```

---

### Task 6: Refactor agents to use `get_llm`

**Files:**
- Modify: `server/agents/context_builder.py:1-22`
- Modify: `server/agents/analyzer.py:1-21`
- Modify: `server/agents/suggestion.py:1-21`

No new tests for this task — agent behavior is unchanged, and the existing codebase has no agent tests. Verification is the existing test suite (no regressions) plus the manual smoke test in Task 11.

- [ ] **Step 1: Modify `server/agents/context_builder.py`**

Replace the top of the file (lines 1-22) with:

```python
from langchain_core.messages import SystemMessage, HumanMessage
from graph.state import AgentState
from llm.factory import get_llm
import json
from typing import Dict, Any, List
from collections import Counter


class ContextBuilderAgent:
    """
    Context Builder Agent - Builds rich session context from ALL user interactions
    Uses the configured LLM provider (see settings.llm_provider) for context extraction.
    """

    def __init__(self):
        self.llm = get_llm("context_builder")
```

(The `settings` import is no longer used in this file — remove it. The temperature/max_tokens are now owned by the factory's `ROLE_CONFIG`.)

- [ ] **Step 2: Modify `server/agents/analyzer.py`**

Replace the top of the file (lines 1-21) with:

```python
from langchain_core.messages import SystemMessage, HumanMessage
from graph.state import AgentState
from llm.factory import get_llm
import json
from typing import Dict, Any


class AnalyzerAgent:
    """
    Intent Analyzer Agent - Deep analysis of user intent and behavior
    Uses the configured LLM provider for advanced reasoning about user goals.
    """

    def __init__(self):
        self.llm = get_llm("analyzer")
```

- [ ] **Step 3: Modify `server/agents/suggestion.py`**

Replace the top of the file (lines 1-21) with:

```python
from langchain_core.messages import SystemMessage, HumanMessage
from graph.state import AgentState
from llm.factory import get_llm
import json
from typing import Dict, Any


class SuggestionAgent:
    """
    Suggestion Agent - Provides actionable help based on deep user intent understanding
    Uses the configured LLM provider for insightful, helpful suggestions.
    """

    def __init__(self):
        self.llm = get_llm("suggestion")
```

- [ ] **Step 4: Smoke-import to confirm nothing is broken**

```bash
cd server && PYTHONPATH=. GOOGLE_API_KEY=AIzaTest python -c "from graph.workflow import workflow_app; print('workflow imports OK')"
```

Expected: `✅ Settings loaded successfully` block followed by `workflow imports OK`.

- [ ] **Step 5: Run all tests**

```bash
cd server && PYTHONPATH=. GOOGLE_API_KEY=AIzaTest pytest -v
```

Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add server/agents/context_builder.py server/agents/analyzer.py server/agents/suggestion.py
git commit -m "refactor(agents): use get_llm factory instead of hard-coded Gemini client"
```

---

### Task 7: Remove `X-Gemini-API-Key` handling from routes.py

**Files:**
- Modify: `server/api/routes.py`

- [ ] **Step 1: Edit `server/api/routes.py`**

Apply this diff. The goal is to remove the `x_gemini_api_key` header parameter and the per-request mutation of `os.environ` / `settings.google_api_key` (which was a concurrency hazard and was also dead code — the agent's LLM clients are built at import time and never re-read the mutated key).

```diff
-from fastapi import APIRouter, HTTPException, status, Header
-from typing import Optional
+from fastapi import APIRouter, HTTPException, status
 from models.schemas import (
     AnalyzeRequest,
     AnalyzeResponse,
     HealthResponse,
     ErrorResponse,
     ActionRequest
 )
 from graph.workflow import run_analysis_workflow
 from utils.helpers import RequestLogger, calculate_interaction_summary, log_info
 from config.settings import settings
 from datetime import datetime
 import time
-import os
```

```diff
 @router.post("/api/analyze", response_model=AnalyzeResponse)
-async def analyze_behavior(
-    request: AnalyzeRequest,
-    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")
-):
+async def analyze_behavior(request: AnalyzeRequest):
     """
     Analyze user behavior and provide suggestions

     Args:
         request: Analysis request with user interactions
-        x_gemini_api_key: Optional Gemini API key from extension

     Returns:
         Analysis response with suggestions and actions
     """
     start_time = time.time()

     try:
-        # Use client-provided API key if available, otherwise use server config
-        if x_gemini_api_key:
-            os.environ["GOOGLE_API_KEY"] = x_gemini_api_key
-            settings.google_api_key = x_gemini_api_key
-            log_info("🔑 Using client-provided Gemini API key")
-
         RequestLogger.log_request("/api/analyze", "POST", {
```

(Leave the `from config.settings import settings` import alone — `settings` may be used elsewhere in this file or future edits. Run `grep "settings" server/api/routes.py` after the edit; if no usage remains, remove the import as well.)

- [ ] **Step 2: Smoke-import to confirm syntax**

```bash
cd server && PYTHONPATH=. GOOGLE_API_KEY=AIzaTest python -c "from api.routes import router; print('routes import OK')"
```

Expected: `routes import OK`.

- [ ] **Step 3: Run all tests**

```bash
cd server && PYTHONPATH=. GOOGLE_API_KEY=AIzaTest pytest -v
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add server/api/routes.py
git commit -m "refactor(routes): remove X-Gemini-API-Key header path"
```

---

### Task 8: Remove API-key field from extension popup

**Files:**
- Modify: `yukti/popup.tsx`

- [ ] **Step 1: Remove the API-key state hooks**

In `yukti/popup.tsx`, delete lines 53-56 (the comment + three `useState` declarations):

```diff
-  // API Key settings
-  const [geminiApiKey, setGeminiApiKey] = useState("")
-  const [showApiKey, setShowApiKey] = useState(false)
-  const [apiKeySaved, setApiKeySaved] = useState(false)
```

- [ ] **Step 2: Remove the storage read of `geminiApiKey`**

Around lines 156-173, the function that loads settings reads `geminiApiKey` from storage. Apply this diff (line numbers approximate — search for the exact block):

```diff
     const result = await chrome.storage.local.get([
       "disableClicks",
       "disableScrolling",
       "disableNavigation",
       "disableFormInteractions",
       "disableInputValues",
-      "geminiApiKey"
     ])

     setDisableClicks(result.disableClicks || false)
     setDisableScrolling(result.disableScrolling || false)
     setDisableNavigation(result.disableNavigation || false)
     setDisableFormInteractions(result.disableFormInteractions || false)
     setDisableInputValues(result.disableInputValues || false)
-    setGeminiApiKey(result.geminiApiKey || "")
   }
```

- [ ] **Step 3: Remove the `saveApiKey` function**

Delete the entire function (lines 175-183):

```diff
-  async function saveApiKey() {
-    try {
-      await chrome.storage.local.set({ geminiApiKey })
-      setApiKeySaved(true)
-      setTimeout(() => setApiKeySaved(false), 2000)
-    } catch (error) {
-      console.error("Failed to save API key:", error)
-    }
-  }
-
```

- [ ] **Step 4: Remove the API-key UI section**

Delete lines 415-453 — the entire `<h3>API Configuration</h3>` block and the `<div style={styles.apiKeySection}>` it precedes:

```diff
-            <h3 style={{...styles.subtitle, marginTop: 24}}>API Configuration</h3>
-
-            <div style={styles.apiKeySection}>
-              <div style={styles.settingLabel}>Gemini API Key</div>
-              <div style={styles.settingDesc}>
-                Enter your Google Gemini API key for AI suggestions
-              </div>
-              <div style={styles.apiKeyInputWrapper}>
-                <input
-                  type={showApiKey ? "text" : "password"}
-                  value={geminiApiKey}
-                  onChange={(e) => setGeminiApiKey(e.target.value)}
-                  placeholder="AIza..."
-                  style={styles.apiKeyInput}
-                />
-                <button
-                  onClick={() => setShowApiKey(!showApiKey)}
-                  style={styles.apiKeyToggle}
-                >
-                  {showApiKey ? "🙈" : "👁️"}
-                </button>
-              </div>
-              <button
-                onClick={saveApiKey}
-                style={styles.saveApiKeyButton}
-              >
-                {apiKeySaved ? "✓ SAVED" : "SAVE KEY"}
-              </button>
-              <div style={styles.apiKeyHint}>
-                Get your key from{" "}
-                <a
-                  href="https://aistudio.google.com/apikey"
-                  target="_blank"
-                  style={styles.apiKeyLink}
-                >
-                  Google AI Studio
-                </a>
-              </div>
-            </div>
```

(Style entries like `styles.apiKeySection`, `styles.apiKeyInput`, etc. are now unused. Leave them — pruning unused CSS objects is YAGNI for this task.)

- [ ] **Step 5: Verify the file still type-checks**

```bash
cd yukti && npx tsc --noEmit
```

Expected: no errors.

If tsc reports unused-variable errors on the deleted state, search the file for any remaining reference to `geminiApiKey`, `showApiKey`, `apiKeySaved`, or `saveApiKey` and remove them.

- [ ] **Step 6: Commit**

```bash
git add yukti/popup.tsx
git commit -m "refactor(extension): remove Gemini API key field from popup settings"
```

---

### Task 9: Remove `X-Gemini-API-Key` header from background.ts

**Files:**
- Modify: `yukti/background.ts`

- [ ] **Step 1: Edit `yukti/background.ts`**

Apply this diff around lines 217 and 251-258:

```diff
   try {
-    const result = await chrome.storage.local.get(["interactions", "geminiApiKey"])
+    const result = await chrome.storage.local.get(["interactions"])
     const interactions: UserInteraction[] = result.interactions || []
-    const geminiApiKey = result.geminiApiKey || ""

     // Take last 50 interactions for analysis
     const recentInteractions = interactions.slice(-50)
```

```diff
     // Call server API
-    const headers: Record<string, string> = {
-      "Content-Type": "application/json"
-    }
-
-    // Add API key header if available
-    if (geminiApiKey) {
-      headers["X-Gemini-API-Key"] = geminiApiKey
-    }
-
     const response = await fetch(`${SERVER_URL}/api/analyze`, {
       method: "POST",
-      headers,
+      headers: { "Content-Type": "application/json" },
       body: JSON.stringify(payload)
     })
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd yukti && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add yukti/background.ts
git commit -m "refactor(extension): stop sending X-Gemini-API-Key header"
```

---

### Task 10: Ship `.env.example` with per-provider model samples

**Files:**
- Create: `server/.env.example`

- [ ] **Step 1: Create `server/.env.example`**

```bash
# ───────────────────────────────────────────────────────────────
# Yukti server configuration
# Copy this file to `.env` and fill in the keys for the provider you choose.
# ───────────────────────────────────────────────────────────────

# Provider selection — one of: gemini | openai | groq | mistral
LLM_PROVIDER=gemini

# ── API keys (set the one matching LLM_PROVIDER; leave others blank) ──
GOOGLE_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=

# ── Per-role model names ──
# Use names valid for the chosen provider. Examples below.
#
# Gemini:
CONTEXT_BUILDER_MODEL=gemini-2.5-flash
ANALYZER_MODEL=gemini-2.5-pro
SUGGESTION_MODEL=gemini-2.5-pro
#
# OpenAI examples:
# CONTEXT_BUILDER_MODEL=gpt-4o-mini
# ANALYZER_MODEL=gpt-4o
# SUGGESTION_MODEL=gpt-4o
#
# Groq examples:
# CONTEXT_BUILDER_MODEL=llama-3.1-8b-instant
# ANALYZER_MODEL=llama-3.3-70b-versatile
# SUGGESTION_MODEL=llama-3.3-70b-versatile
#
# Mistral examples:
# CONTEXT_BUILDER_MODEL=mistral-small-latest
# ANALYZER_MODEL=mistral-large-latest
# SUGGESTION_MODEL=mistral-large-latest

# ── Server ──
HOST=0.0.0.0
PORT=8000
DEBUG=true

# ── CORS (comma-separated origins, or "*") ──
ALLOWED_ORIGINS=*

# ── Batch processing ──
BATCH_SIZE=50
ANALYSIS_THRESHOLD=20

# ── Logging ──
LOG_LEVEL=INFO
```

- [ ] **Step 2: Commit**

```bash
git add server/.env.example
git commit -m "docs(server): add .env.example with per-provider model samples"
```

---

### Task 11: Manual smoke test (no commit, just verification)

This is the end-to-end verification. No code changes — just confirm both providers work and the extension still functions without its old API-key field.

- [ ] **Step 1: Smoke test with Gemini**

```bash
cd server
cp .env.example .env
# Edit .env, set GOOGLE_API_KEY=<your real Gemini key>
PYTHONPATH=. uvicorn main:app --host 0.0.0.0 --port 8000
```

In a second terminal:

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "interactions": [
      {"type":"navigation","url":"https://example.com","timestamp":1717800000000,"tabTitle":"Example"}
    ],
    "current_url": "https://example.com",
    "page_content": "Example page",
    "tab_id": 1
  }'
```

Expected: HTTP 200 with a JSON body containing `suggestions`, `intent`, `confidence`. Server logs should show `Provider: gemini`.

- [ ] **Step 2: Smoke test with Groq**

Stop the server (Ctrl-C). Edit `.env`:

```diff
- LLM_PROVIDER=gemini
+ LLM_PROVIDER=groq
+ GROQ_API_KEY=<your real Groq key>
- CONTEXT_BUILDER_MODEL=gemini-2.5-flash
- ANALYZER_MODEL=gemini-2.5-pro
- SUGGESTION_MODEL=gemini-2.5-pro
+ CONTEXT_BUILDER_MODEL=llama-3.1-8b-instant
+ ANALYZER_MODEL=llama-3.3-70b-versatile
+ SUGGESTION_MODEL=llama-3.3-70b-versatile
```

Restart the server. Re-run the same curl. Expected: HTTP 200, server logs show `Provider: groq`.

- [ ] **Step 3: Smoke test the hard-fail path**

Stop the server. In `.env`, blank out the active provider's key:

```diff
- GROQ_API_KEY=<your key>
+ GROQ_API_KEY=
```

Try to start the server again. Expected: it crashes at startup with `ValueError: GROQ_API_KEY is not set but LLM_PROVIDER=groq.`

Restore the key.

- [ ] **Step 4: Smoke test the extension**

Build the extension:

```bash
cd yukti && npm run build
```

Load the unpacked extension from `yukti/build/chrome-mv3-prod` in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

- Open the extension popup. Confirm the **"API Configuration" / "Gemini API Key"** section is **gone**.
- Browse some pages to generate interactions.
- After 30 interactions, the extension calls `/api/analyze`. Check the server logs: confirm no `X-Gemini-API-Key` header is logged and suggestions still return.

- [ ] **Step 5: If all four steps pass, the rollout is complete.**

No commit for this task.

---

## Spec coverage check (self-review)

| Spec section | Task(s) |
|---|---|
| Approach: `init_chat_model` wrapper | Task 4 |
| `server/llm/providers.py` registry | Task 2 |
| `server/llm/factory.py` with `get_llm` + `lru_cache` | Task 4 |
| `settings.py` adds `llm_provider`, per-provider keys | Task 3 |
| `validate_settings()` hard-fails on missing active key / unknown provider / missing package | Task 5 |
| Agents use `get_llm`, drop direct provider import | Task 6 |
| `routes.py` removes `X-Gemini-API-Key` and `os.environ` mutation | Task 7 |
| Extension popup removes API-key field | Task 8 |
| Extension background stops sending header | Task 9 |
| `requirements.txt` adds openai/groq/mistral packages, dev deps file with pytest | Task 1 |
| Three seam-targeted factory tests | Task 4 (plus settings/provider tests in Tasks 2/3/5) |
| Manual smoke-test plan | Task 11 |
| `.env.example` with per-provider samples | Task 10 |

Out-of-scope items from the spec (retries, fallback chains, runtime hot-swap, streaming, CI, `INTEGRATION_GUIDE.md` rewrite) are intentionally not in this plan.
