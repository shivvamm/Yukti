# RAG + Chat Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the proactive 3-agent suggestion pipeline with an on-demand chat assistant grounded in Pinecone RAG (over the user's tracked interactions) plus the live page DOM.

**Architecture:** Server gets a new `rag/` package (formatter → pinecone_client → chat) and two new endpoints (`/api/index`, `/api/chat`). The 3 agent files and the LangGraph workflow are deleted entirely. Multi-LLM provider factory is preserved but its `ROLE_CONFIG` is narrowed from three agent roles to a single `"chat"` role. Extension's `chatbot-float.tsx` is rewritten to expand into a chat panel; `background.ts` is repointed from `/api/analyze` to `/api/index` and gains an `ASK_CHAT` message handler.

**Tech Stack:** Python 3.12 / FastAPI / pydantic-settings / `pinecone==5.4.2` (integrated embeddings) / LangChain `init_chat_model` (kept) / pytest. TypeScript + React + Plasmo (extension).

**Spec:** `docs/superpowers/specs/2026-06-07-rag-chat-pivot-design.md`

---

## Working directory

All commands assume CWD is the repo root unless prefixed with `cd server` or `cd yukti`. Server commands use the project venv:

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti
```

For server work:
```bash
cd server && source .venv/bin/activate
```

`pytest` commands assume `PYTHONPATH=.` set from inside `server/`. The `conftest.py` already stubs `GOOGLE_API_KEY=test-stub-key` and `LLM_PROVIDER=gemini`; this plan adds `PINECONE_API_KEY=test-stub-key` to that bootstrap.

---

### Task 1: Add `pinecone` Python dependency

**Files:**
- Modify: `server/requirements.txt`

- [ ] **Step 1: Append the Pinecone SDK to `server/requirements.txt`**

Add this line after the existing `langchain-mistralai==0.2.1` line:

```
pinecone==5.4.2
```

- [ ] **Step 2: Install and verify**

```bash
cd server && source .venv/bin/activate && pip install -r requirements-dev.txt
python -c "from pinecone import Pinecone; from pinecone import ServerlessSpec; print('OK')"
```

Expected output: `OK`.

If the install fails with a version conflict, try the next lower minor in the v5 line (`5.3.1`, `5.2.0`, etc.) until both `pip install` succeeds and the import line prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add server/requirements.txt
git commit -m "deps: add pinecone SDK for RAG support"
```

---

### Task 2: Update settings — add Pinecone fields and `chat_model`, remove agent model fields

**Files:**
- Modify: `server/config/settings.py`
- Modify: `server/tests/test_settings_fields.py`
- Modify: `server/tests/conftest.py`

- [ ] **Step 1: Update the failing test file**

Replace the entire contents of `server/tests/test_settings_fields.py` with:

```python
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
    assert s.chat_model  # has a non-empty default


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
```

- [ ] **Step 2: Run tests — expect several failures**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_settings_fields.py -v
```

Expected: at least 3 failures (`test_settings_has_pinecone_fields`, `test_settings_has_chat_model_field`, `test_settings_no_longer_has_agent_model_fields`).

- [ ] **Step 3: Modify `server/config/settings.py`**

Apply this diff to the `Settings` class body:

```diff
     # LLM Provider Configuration
     llm_provider: Literal["gemini", "openai", "groq", "mistral"] = "gemini"

     # Provider API keys — set the one matching llm_provider
     google_api_key:  str = ""
     openai_api_key:  str = ""
     groq_api_key:    str = ""
     mistral_api_key: str = ""

-    # Model Configuration (Gemini 2.5 models) - New 3-Agent Architecture
-    context_builder_model: str = "gemini-2.5-flash"  # Fast context extraction
-    analyzer_model: str = "gemini-2.5-pro"  # Deep intent analysis
-    suggestion_model: str = "gemini-2.5-pro"  # Actionable suggestions
+    # Chat model (used by the single chat role in the LLM factory)
+    chat_model: str = "gemini-2.5-pro"
+
+    # Pinecone (RAG vector store with integrated embeddings)
+    pinecone_api_key:     str = ""
+    pinecone_index_name:  str = "yukti-interactions"
+    pinecone_embed_model: str = "multilingual-e5-large"
+    pinecone_cloud:       str = "aws"
+    pinecone_region:      str = "us-east-1"
```

- [ ] **Step 4: Update `server/tests/conftest.py`**

Append `os.environ.setdefault("PINECONE_API_KEY", "test-stub-key")` so the bootstrap covers Pinecone too. The file should end up as:

```python
"""Test bootstrap.

Sets stub keys before `config.settings` is imported so that the
module-level `validate_settings()` call doesn't crash test collection.
Real provider behavior is exercised via monkeypatch in individual tests.
"""

import os

os.environ.setdefault("GOOGLE_API_KEY", "test-stub-key")
os.environ.setdefault("LLM_PROVIDER", "gemini")
os.environ.setdefault("PINECONE_API_KEY", "test-stub-key")
```

- [ ] **Step 5: Run settings tests — expect green**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_settings_fields.py -v
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add server/config/settings.py server/tests/test_settings_fields.py server/tests/conftest.py
git commit -m "feat(settings): swap agent model fields for chat_model + pinecone fields"
```

---

### Task 3: Update `llm/factory.py` — narrow `ROLE_CONFIG` to a single `chat` role

**Files:**
- Modify: `server/llm/factory.py`
- Modify: `server/tests/test_llm_factory.py`

- [ ] **Step 1: Update the test file**

Replace the entire contents of `server/tests/test_llm_factory.py` with:

```python
import pytest
from langchain_core.language_models import BaseChatModel
from config.settings import settings
from llm.factory import get_llm
from llm.providers import PROVIDERS


@pytest.mark.parametrize("provider", ["gemini", "openai", "groq", "mistral"])
def test_get_llm_returns_chat_model_for_each_provider(monkeypatch, provider):
    monkeypatch.setattr(settings, "llm_provider", provider)
    monkeypatch.setattr(settings, PROVIDERS[provider].key_attr, "test-key-value")
    get_llm.cache_clear()
    llm = get_llm("chat")
    assert isinstance(llm, BaseChatModel)


def test_get_llm_invalid_role_raises(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    with pytest.raises(KeyError):
        get_llm("not_a_role")  # type: ignore[arg-type]


def test_get_llm_caches_per_role(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    a = get_llm("chat")
    b = get_llm("chat")
    assert a is b


def test_get_llm_rejects_old_agent_roles(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "test-key-value")
    get_llm.cache_clear()
    for old_role in ("context_builder", "analyzer", "suggestion"):
        with pytest.raises(KeyError):
            get_llm(old_role)  # type: ignore[arg-type]
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_llm_factory.py -v
```

Expected: failures because `ROLE_CONFIG` still has the old 3 roles and `chat` is missing.

- [ ] **Step 3: Modify `server/llm/factory.py`**

Replace the `Role` type alias and `ROLE_CONFIG` block with:

```python
Role = Literal["chat"]

# (settings_model_attr, temperature, max_tokens) — single role for the chat pipeline
ROLE_CONFIG: dict[str, tuple[str, float, int]] = {
    "chat": ("chat_model", 0.5, 1024),
}
```

Leave the `get_llm()` body unchanged — it already uses `ROLE_CONFIG[role]` lookup that will now raise `KeyError` for the old role strings.

- [ ] **Step 4: Run tests — expect green**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_llm_factory.py -v
```

Expected: 7 passed (4 parametrized + 3 standalone).

- [ ] **Step 5: Commit**

```bash
git add server/llm/factory.py server/tests/test_llm_factory.py
git commit -m "refactor(llm): collapse ROLE_CONFIG to single chat role"
```

---

### Task 4: Update `validate_settings()` — also require `PINECONE_API_KEY`

**Files:**
- Modify: `server/config/settings.py`
- Modify: `server/tests/test_validate_settings.py`

- [ ] **Step 1: Update the test file**

Append these two tests to `server/tests/test_validate_settings.py`:

```python
def test_validate_raises_when_pinecone_key_missing(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "AIzaTest")
    monkeypatch.setattr(settings, "pinecone_api_key", "")
    with pytest.raises(ValueError, match="PINECONE_API_KEY"):
        validate_settings()


def test_validate_passes_with_both_provider_and_pinecone_keys(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "google_api_key", "AIzaTest")
    monkeypatch.setattr(settings, "pinecone_api_key", "pc_test_key")
    validate_settings()  # must not raise
```

- [ ] **Step 2: Run tests — expect 1 failure**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_validate_settings.py -v
```

Expected: `test_validate_raises_when_pinecone_key_missing` fails (current `validate_settings` doesn't check Pinecone key).

- [ ] **Step 3: Modify `validate_settings()` in `server/config/settings.py`**

Add the Pinecone check after the existing provider-package check, before the `print` block:

```python
    # Pinecone key required for RAG indexing/retrieval
    if not settings.pinecone_api_key:
        raise ValueError(
            "PINECONE_API_KEY is not set. RAG indexing and chat retrieval "
            "require a Pinecone API key. Set PINECONE_API_KEY in your .env "
            "file. Get a key at https://app.pinecone.io"
        )
```

Also update the success print block to mention Pinecone:

```diff
     print(f"✅ Settings loaded successfully")
     print(f"   - Provider: {settings.llm_provider}")
-    print(f"   - Context Builder: {settings.context_builder_model}")
-    print(f"   - Intent Analyzer: {settings.analyzer_model}")
-    print(f"   - Suggestion: {settings.suggestion_model}")
+    print(f"   - Chat model: {settings.chat_model}")
+    print(f"   - Pinecone index: {settings.pinecone_index_name} ({settings.pinecone_embed_model})")
     print(f"   - Server: {settings.host}:{settings.port}")
     print(f"   - Debug Mode: {settings.debug}")
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_validate_settings.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add server/config/settings.py server/tests/test_validate_settings.py
git commit -m "feat(settings): require PINECONE_API_KEY at startup"
```

---

### Task 5: Create `rag/formatter.py` — turn interaction dicts into embeddable text

**Files:**
- Create: `server/rag/__init__.py` (empty)
- Create: `server/rag/formatter.py`
- Create: `server/tests/test_formatter.py`

- [ ] **Step 1: Write the failing tests**

Create `server/rag/__init__.py` as empty, then create `server/tests/test_formatter.py`:

```python
from rag.formatter import format, FormattedRecord


def test_click_with_text_formats_readable():
    record = format({
        "type": "click",
        "url": "https://workatastartup.com/companies?query=AI",
        "tabTitle": "Companies — Work at a Startup",
        "elementText": "Apply now",
        "elementType": "button",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert isinstance(record, FormattedRecord)
    assert "Clicked button 'Apply now'" in record.values_text
    assert "workatastartup.com" in record.values_text
    assert record.metadata["type"] == "click"
    assert record.metadata["url"] == "https://workatastartup.com/companies?query=AI"
    assert record.id  # non-empty deterministic id


def test_navigation_formats_with_title():
    record = format({
        "type": "navigation",
        "url": "https://news.ycombinator.com/",
        "tabTitle": "Hacker News",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "Visited Hacker News" in record.values_text
    assert "news.ycombinator.com" in record.values_text


def test_input_value_formats():
    record = format({
        "type": "input_value",
        "url": "https://www.google.com/search?q=AI+engineer",
        "tabTitle": "AI engineer - Google Search",
        "inputName": "q",
        "inputValue": "AI engineer",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "Typed 'AI engineer'" in record.values_text
    assert "google.com" in record.values_text


def test_scroll_returns_none():
    assert format({
        "type": "scroll",
        "scrollDepth": 75,
        "url": "https://example.com",
        "timestamp": 1717764493000,
    }) is None


def test_form_interaction_formats():
    record = format({
        "type": "form_interaction",
        "url": "https://example.com/signup",
        "inputName": "email",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "Focused email field" in record.values_text


def test_unknown_type_uses_generic_fallback():
    record = format({
        "type": "tab_activated",
        "url": "https://example.com",
        "timestamp": 1717764493000,
    })
    assert record is not None
    assert "tab_activated" in record.values_text
    assert "example.com" in record.values_text


def test_null_fields_dont_crash():
    record = format({
        "type": "click",
        "url": "https://example.com",
        "elementText": None,
        "elementType": None,
        "tabTitle": None,
        "timestamp": 1717764493000,
    })
    assert record is not None  # falls back to generic phrasing


def test_id_is_deterministic():
    event = {
        "type": "click",
        "url": "https://example.com",
        "elementText": "X",
        "timestamp": 1717764493000,
    }
    a = format(event)
    b = format(event)
    assert a.id == b.id


def test_id_differs_when_fields_differ():
    a = format({"type": "click", "url": "https://example.com",
                "elementText": "A", "timestamp": 1717764493000})
    b = format({"type": "click", "url": "https://example.com",
                "elementText": "B", "timestamp": 1717764493000})
    assert a.id != b.id
```

- [ ] **Step 2: Run tests — expect import failure**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_formatter.py -v
```

Expected: `ModuleNotFoundError: No module named 'rag.formatter'`.

- [ ] **Step 3: Create `server/rag/formatter.py`**

```python
"""Transform raw browser-interaction dicts into Pinecone-ready records.

Each interaction becomes one vector. The `values_text` field is what
Pinecone embeds; the `metadata` field is what we filter/return on.

Scrolls are skipped — they're pure noise without page content.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


@dataclass(frozen=True)
class FormattedRecord:
    id: str
    values_text: str
    metadata: dict[str, Any]


def format(interaction: dict[str, Any]) -> FormattedRecord | None:
    """Convert one interaction dict into a FormattedRecord, or None if skipped."""
    event_type = interaction.get("type") or "unknown"
    if event_type == "scroll":
        return None

    url = interaction.get("url") or ""
    timestamp_ms = interaction.get("timestamp") or 0
    hostname = urlparse(url).hostname or "unknown"
    date_str = _format_date(timestamp_ms)

    values_text = _render_text(interaction, event_type, hostname, date_str)
    metadata = _build_metadata(interaction, event_type)
    record_id = _make_id(interaction, event_type)

    return FormattedRecord(id=record_id, values_text=values_text, metadata=metadata)


def _render_text(interaction: dict, event_type: str, hostname: str, date_str: str) -> str:
    """Render a one-line natural-language description of the event."""
    if event_type == "click":
        el_type = interaction.get("elementType") or "element"
        el_text = interaction.get("elementText") or ""
        if el_text:
            return f"Clicked {el_type} '{el_text}' on {hostname} ({date_str})"
        return f"Clicked {el_type} on {hostname} ({date_str})"

    if event_type == "navigation":
        title = interaction.get("tabTitle") or hostname
        return f"Visited {title} at {hostname} ({date_str})"

    if event_type == "input_value":
        name = interaction.get("inputName") or "field"
        value = interaction.get("inputValue") or ""
        return f"Typed '{value}' into {name} on {hostname} ({date_str})"

    if event_type == "form_interaction":
        name = interaction.get("inputName") or "field"
        return f"Focused {name} field on {hostname} ({date_str})"

    return f"User activity ({event_type}) on {hostname} ({date_str})"


def _build_metadata(interaction: dict, event_type: str) -> dict[str, Any]:
    """Pinecone metadata must be JSON-serializable scalars/lists. Drop Nones safely."""
    md: dict[str, Any] = {
        "type": event_type,
        "url": interaction.get("url") or "",
        "tab_title": interaction.get("tabTitle") or "",
        "timestamp": int(interaction.get("timestamp") or 0),
    }
    # Optional fields — include only when non-null to keep metadata payload small
    for key, src_key in [
        ("element_text", "elementText"),
        ("element_type", "elementType"),
        ("input_name", "inputName"),
        ("input_value", "inputValue"),
    ]:
        v = interaction.get(src_key)
        if v:
            md[key] = v
    return md


def _make_id(interaction: dict, event_type: str) -> str:
    """Deterministic SHA1 of the canonical fields → idempotent upsert."""
    canonical = "|".join([
        event_type,
        interaction.get("url") or "",
        str(int(interaction.get("timestamp") or 0) // 1000),  # second precision
        interaction.get("elementText") or "",
        interaction.get("inputValue") or "",
    ])
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def _format_date(timestamp_ms: int) -> str:
    """Format epoch-ms as a human/LLM-friendly date, UTC."""
    if not timestamp_ms:
        return "unknown date"
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    return dt.strftime("%a %b %-d %Y, %H:%M")
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_formatter.py -v
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add server/rag/__init__.py server/rag/formatter.py server/tests/test_formatter.py
git commit -m "feat(rag): add formatter for embeddable interaction records"
```

---

### Task 6: Create `rag/pinecone_client.py` — thin wrapper around the Pinecone SDK

**Files:**
- Create: `server/rag/pinecone_client.py`
- Create: `server/tests/test_pinecone_client.py`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/test_pinecone_client.py`:

```python
"""Test the Pinecone wrapper by monkeypatching the SDK with fakes.

We never hit a real Pinecone in tests — too slow, costs money, flaky.
"""
import pytest
from rag import pinecone_client as pc
from rag.formatter import FormattedRecord


class FakeIndex:
    def __init__(self):
        self.upserts: list = []
        self.queries: list = []
        self.fake_query_result = {
            "result": {
                "hits": [
                    {
                        "_id": "id1",
                        "_score": 0.92,
                        "fields": {
                            "values_text": "Visited Hacker News at news.ycombinator.com (Sun Jun 7 2026, 12:00)",
                            "url": "https://news.ycombinator.com/",
                            "tab_title": "Hacker News",
                            "timestamp": 1717764493000,
                            "type": "navigation",
                        },
                    },
                ]
            }
        }

    def upsert_records(self, namespace, records):
        self.upserts.append((namespace, list(records)))

    def search(self, namespace, query, fields=None):
        self.queries.append((namespace, query, fields))
        return self.fake_query_result


class FakePinecone:
    def __init__(self, api_key):
        self.api_key = api_key
        self.created_indexes: list = []
        self._index = FakeIndex()
        self._existing_indexes: list[str] = []

    def has_index(self, name):
        return name in self._existing_indexes

    def create_index_for_model(self, name, cloud, region, embed):
        self.created_indexes.append({"name": name, "cloud": cloud, "region": region, "embed": embed})
        self._existing_indexes.append(name)

    def Index(self, name):
        return self._index


@pytest.fixture(autouse=True)
def reset_module(monkeypatch):
    """Each test gets a fresh fake Pinecone."""
    fake = FakePinecone(api_key="test-stub-key")
    monkeypatch.setattr(pc, "Pinecone", lambda api_key: fake)
    pc._reset_for_tests()
    return fake


def test_ensure_index_creates_when_missing(reset_module):
    pc.ensure_index()
    fake = reset_module
    assert len(fake.created_indexes) == 1
    created = fake.created_indexes[0]
    assert created["name"] == "yukti-interactions"
    assert created["cloud"] == "aws"
    assert created["region"] == "us-east-1"
    assert created["embed"]["model"] == "multilingual-e5-large"
    assert created["embed"]["field_map"] == {"text": "values_text"}


def test_ensure_index_skips_when_present(reset_module):
    reset_module._existing_indexes.append("yukti-interactions")
    pc.ensure_index()
    assert len(reset_module.created_indexes) == 0


def test_upsert_texts_passes_records_through(reset_module):
    reset_module._existing_indexes.append("yukti-interactions")
    records = [
        FormattedRecord(id="a", values_text="text-a", metadata={"url": "u1"}),
        FormattedRecord(id="b", values_text="text-b", metadata={"url": "u2"}),
    ]
    result = pc.upsert_texts(records)
    assert result == {"indexed": 2}
    upserted_ns, upserted_records = reset_module._index.upserts[0]
    assert upserted_ns == "default"
    # Records sent in Pinecone's expected dict shape
    assert upserted_records[0]["_id"] == "a"
    assert upserted_records[0]["values_text"] == "text-a"
    assert upserted_records[0]["url"] == "u1"


def test_upsert_empty_records_is_noop(reset_module):
    result = pc.upsert_texts([])
    assert result == {"indexed": 0}
    assert reset_module._index.upserts == []


def test_query_returns_query_hits(reset_module):
    reset_module._existing_indexes.append("yukti-interactions")
    hits = pc.query("what was the news site?", top_k=5)
    assert len(hits) == 1
    assert hits[0].id == "id1"
    assert hits[0].score == 0.92
    assert hits[0].values_text.startswith("Visited Hacker News")
    assert hits[0].metadata["url"] == "https://news.ycombinator.com/"
    # Query was passed correctly to fake
    _, query_payload, fields = reset_module._index.queries[0]
    assert query_payload["inputs"]["text"] == "what was the news site?"
    assert query_payload["top_k"] == 5
```

- [ ] **Step 2: Run tests — expect import failure**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_pinecone_client.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Create `server/rag/pinecone_client.py`**

```python
"""Thin wrapper around the Pinecone SDK using integrated embeddings.

We use Pinecone's hosted inference: upsert raw text + metadata, query by
text. Pinecone embeds server-side via the model configured at
index-creation time. No embedding round-trip lives in our code.
"""

from dataclasses import dataclass
from typing import Any, Iterable

from pinecone import Pinecone

from config.settings import settings
from rag.formatter import FormattedRecord

NAMESPACE = "default"

_pinecone: Pinecone | None = None
_index = None


def _reset_for_tests() -> None:
    """Hook for tests: drop the module-level Pinecone client + index handle."""
    global _pinecone, _index
    _pinecone = None
    _index = None


def _client() -> Pinecone:
    global _pinecone
    if _pinecone is None:
        _pinecone = Pinecone(api_key=settings.pinecone_api_key)
    return _pinecone


def _index_handle():
    global _index
    if _index is None:
        _index = _client().Index(settings.pinecone_index_name)
    return _index


def ensure_index() -> None:
    """Create the configured index if it doesn't exist. Idempotent."""
    client = _client()
    if client.has_index(settings.pinecone_index_name):
        return
    client.create_index_for_model(
        name=settings.pinecone_index_name,
        cloud=settings.pinecone_cloud,
        region=settings.pinecone_region,
        embed={
            "model": settings.pinecone_embed_model,
            "field_map": {"text": "values_text"},
        },
    )


def upsert_texts(records: Iterable[FormattedRecord]) -> dict[str, int]:
    """Upsert FormattedRecords to Pinecone. Returns {indexed: N}."""
    records_list = list(records)
    if not records_list:
        return {"indexed": 0}

    payload = [
        {"_id": r.id, "values_text": r.values_text, **r.metadata}
        for r in records_list
    ]
    _index_handle().upsert_records(NAMESPACE, payload)
    return {"indexed": len(records_list)}


@dataclass(frozen=True)
class QueryHit:
    id: str
    score: float
    values_text: str
    metadata: dict[str, Any]


def query(text: str, top_k: int = 8) -> list[QueryHit]:
    """Query Pinecone by text. Returns top_k QueryHits."""
    response = _index_handle().search(
        NAMESPACE,
        {"inputs": {"text": text}, "top_k": top_k},
        fields=["values_text", "url", "tab_title", "timestamp", "type",
                "element_text", "element_type", "input_name", "input_value"],
    )
    hits_raw = response.get("result", {}).get("hits", [])
    return [
        QueryHit(
            id=h["_id"],
            score=h["_score"],
            values_text=h["fields"].get("values_text", ""),
            metadata={k: v for k, v in h["fields"].items() if k != "values_text"},
        )
        for h in hits_raw
    ]
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_pinecone_client.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add server/rag/pinecone_client.py server/tests/test_pinecone_client.py
git commit -m "feat(rag): add Pinecone client with integrated embeddings"
```

---

### Task 7: Create `rag/chat.py` — assemble RAG prompt and call the LLM

**Files:**
- Create: `server/rag/chat.py`
- Create: `server/tests/test_chat.py`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/test_chat.py`:

```python
from dataclasses import dataclass
from rag.chat import answer, ChatAnswer
from rag.pinecone_client import QueryHit
import rag.chat as chat_module


class FakeLLM:
    def __init__(self, response_text="The answer"):
        self.response_text = response_text
        self.last_messages = None

    def invoke(self, messages):
        self.last_messages = messages
        return type("R", (), {"content": self.response_text})()


def _hit(id_, text, url="https://example.com", ts=1717764493000):
    return QueryHit(id=id_, score=0.9, values_text=text,
                    metadata={"url": url, "timestamp": ts,
                              "tab_title": "Example", "type": "click"})


def test_answer_returns_chat_answer_with_text(monkeypatch):
    fake = FakeLLM(response_text="Hello there.")
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    result = answer(question="hi?", current_url="https://x", current_page_text="",
                    chat_history=[], retrieved=[])
    assert isinstance(result, ChatAnswer)
    assert result.answer == "Hello there."
    assert result.sources == []


def test_answer_includes_current_page_in_prompt(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    answer(question="what page?", current_url="https://workatastartup.com",
           current_page_text="WELCOME TO WORKATASTARTUP", chat_history=[], retrieved=[])
    prompt = _last_user_prompt(fake)
    assert "WELCOME TO WORKATASTARTUP" in prompt
    assert "workatastartup.com" in prompt


def test_answer_includes_retrieved_context_in_prompt(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    answer(question="yesterday?", current_url="", current_page_text="", chat_history=[],
           retrieved=[
               _hit("a", "Visited Hacker News at news.ycombinator.com (Sun Jun 6 2026, 09:00)"),
               _hit("b", "Clicked 'Apply' on workatastartup.com (Sat Jun 6 2026, 14:00)"),
           ])
    prompt = _last_user_prompt(fake)
    assert "Hacker News" in prompt
    assert "workatastartup.com" in prompt
    assert "[YOUR BROWSING HISTORY" in prompt


def test_answer_returns_sources_from_retrieved(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    result = answer(question="?", current_url="", current_page_text="", chat_history=[],
                    retrieved=[_hit("a", "snippet text", url="https://news.ycombinator.com/")])
    assert len(result.sources) == 1
    assert result.sources[0].url == "https://news.ycombinator.com/"
    assert result.sources[0].snippet.startswith("snippet text")


def test_answer_includes_chat_history(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    answer(question="follow up", current_url="", current_page_text="",
           chat_history=[
               {"role": "user", "content": "what's a startup?"},
               {"role": "assistant", "content": "A small company."},
           ],
           retrieved=[])
    prompt = _last_user_prompt(fake)
    assert "what's a startup?" in prompt
    assert "A small company." in prompt


def test_answer_handles_empty_retrieved_gracefully(monkeypatch):
    fake = FakeLLM(response_text="Sure.")
    monkeypatch.setattr(chat_module, "get_llm", lambda role: fake)
    result = answer(question="?", current_url="", current_page_text="",
                    chat_history=[], retrieved=[])
    assert result.answer == "Sure."
    assert result.sources == []


# helpers ----------------------------------------------------------------

def _last_user_prompt(fake: FakeLLM) -> str:
    """Pull the user message content out of the last invoke() call."""
    msgs = fake.last_messages
    assert msgs is not None
    for m in msgs:
        # langchain_core HumanMessage has .content; we just need the user payload text.
        content = getattr(m, "content", str(m))
        if isinstance(content, str) and "[QUESTION]" in content:
            return content
    return ""
```

- [ ] **Step 2: Run tests — expect import failure**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_chat.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Create `server/rag/chat.py`**

```python
"""Assemble RAG prompts and call the LLM.

The prompt has four parts:
  - the live current page DOM text (for "what's on this tab" questions)
  - top-K retrieved interactions (for historical questions)
  - the last N turns of conversation (for multi-turn coherence)
  - the user's question

Returns the answer plus structured sources for the UI to render.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from llm.factory import get_llm
from rag.pinecone_client import QueryHit


@dataclass(frozen=True)
class Source:
    url: str
    timestamp: int
    snippet: str


@dataclass(frozen=True)
class ChatAnswer:
    answer: str
    sources: list[Source]


SYSTEM_PROMPT = (
    "You are Yukti, a personal browser-history assistant. "
    "Answer the user's question based on the live page they are viewing "
    "and the relevant interactions retrieved from their browsing history. "
    "Cite URLs when relevant. If you don't have evidence in the provided "
    "context, say so plainly — never fabricate."
)


def answer(
    *,
    question: str,
    current_url: str,
    current_page_text: str,
    chat_history: list[dict[str, str]],
    retrieved: list[QueryHit],
) -> ChatAnswer:
    """Run a chat turn. Returns the answer + sources for the UI."""
    user_prompt = _build_user_prompt(question, current_url, current_page_text,
                                     chat_history, retrieved)
    llm = get_llm("chat")
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])
    answer_text = response.content if isinstance(response.content, str) else str(response.content)
    sources = [_hit_to_source(h) for h in retrieved]
    return ChatAnswer(answer=answer_text, sources=sources)


def _build_user_prompt(
    question: str,
    current_url: str,
    current_page_text: str,
    chat_history: list[dict[str, str]],
    retrieved: list[QueryHit],
) -> str:
    parts = []
    parts.append(f"[CURRENT PAGE: {current_url or 'none'}]")
    parts.append((current_page_text or "(no page content)")[:3000])
    parts.append("")
    parts.append("[YOUR BROWSING HISTORY — relevant interactions]")
    if retrieved:
        for h in retrieved:
            ts = h.metadata.get("timestamp", 0)
            when = _format_ts(ts) if ts else ""
            parts.append(f"- {when}: {h.values_text}")
    else:
        parts.append("(no relevant interactions found)")
    parts.append("")
    parts.append("[CONVERSATION SO FAR]")
    if chat_history:
        for turn in chat_history:
            role = turn.get("role", "user").upper()
            content = turn.get("content", "")
            parts.append(f"{role}: {content}")
    else:
        parts.append("(this is the first turn)")
    parts.append("")
    parts.append("[QUESTION]")
    parts.append(question)
    return "\n".join(parts)


def _hit_to_source(h: QueryHit) -> Source:
    snippet = h.values_text[:80]
    if len(h.values_text) > 80:
        snippet += "..."
    return Source(
        url=h.metadata.get("url", "") or "",
        timestamp=int(h.metadata.get("timestamp", 0) or 0),
        snippet=snippet,
    )


def _format_ts(ms: int) -> str:
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%a %b %-d %Y, %H:%M")
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_chat.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add server/rag/chat.py server/tests/test_chat.py
git commit -m "feat(rag): add chat assembly with current-page + history + retrieval"
```

---

### Task 8: Rewrite `models/schemas.py` and `api/routes.py`

**Files:**
- Modify: `server/models/schemas.py`
- Modify: `server/api/routes.py`

No new tests for this task — routes are I/O glue. The smoke test in Task 11 covers the wire format end-to-end.

- [ ] **Step 1: Replace `server/models/schemas.py`**

Read the current file once to preserve any non-Analyze types (e.g. `HealthResponse`), then replace its contents with:

```python
"""Request/response schemas for the Yukti server.

Only the endpoints used by the extension are defined here:
  /health    → HealthResponse
  /api/index → IndexRequest, IndexResponse
  /api/chat  → ChatRequest, ChatResponse
"""

from typing import Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# ── /api/index ──────────────────────────────────────────────────────────


class IndexRequest(BaseModel):
    interactions: list[dict[str, Any]] = Field(
        ..., description="Recent interactions to upsert into the RAG vector store."
    )
    current_url: str | None = None
    tab_id: int | None = None


class IndexResponse(BaseModel):
    success: bool
    indexed: int
    skipped: int = 0
    error: str | None = None


# ── /api/chat ───────────────────────────────────────────────────────────


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    current_url: str = ""
    current_page_text: str = ""
    chat_history: list[ChatTurn] = []


class ChatSource(BaseModel):
    url: str
    timestamp: int
    snippet: str


class ChatResponse(BaseModel):
    success: bool
    answer: str | None = None
    sources: list[ChatSource] = []
    error: str | None = None
```

- [ ] **Step 2: Replace `server/api/routes.py`**

```python
"""HTTP routes for Yukti.

  GET  /health      → liveness
  POST /api/index   → upsert interactions into Pinecone
  POST /api/chat    → answer a question using RAG over Pinecone + live page DOM
"""

from datetime import datetime
import time

from fastapi import APIRouter, HTTPException, status

from models.schemas import (
    HealthResponse,
    IndexRequest, IndexResponse,
    ChatRequest, ChatResponse, ChatSource,
)
from rag import chat as chat_module
from rag import pinecone_client
from rag.formatter import format as format_interaction
from utils.helpers import RequestLogger, log_info

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="2.0.0",
    )


@router.post("/api/index", response_model=IndexResponse)
async def index_interactions(request: IndexRequest) -> IndexResponse:
    """Vectorize and upsert interactions into Pinecone."""
    start = time.time()
    try:
        RequestLogger.log_request("/api/index", "POST",
                                  {"interactions": len(request.interactions)})

        records = []
        skipped = 0
        for raw in request.interactions:
            record = format_interaction(raw)
            if record is None:
                skipped += 1
                continue
            records.append(record)

        result = pinecone_client.upsert_texts(records)
        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_response("/api/index", 200, elapsed_ms)
        log_info(f"   Indexed: {result['indexed']}, skipped: {skipped}")

        return IndexResponse(success=True, indexed=result["indexed"], skipped=skipped)

    except Exception as e:
        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_error("/api/index", e)
        RequestLogger.log_response("/api/index", 502, elapsed_ms)
        return IndexResponse(success=False, indexed=0, skipped=0, error=str(e))


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Answer a question grounded in current page DOM + RAG retrieval."""
    start = time.time()
    try:
        RequestLogger.log_request("/api/chat", "POST",
                                  {"question_len": len(request.question),
                                   "page_text_len": len(request.current_page_text)})

        # 1) Retrieve from Pinecone. Tolerate failures — still answer with page context.
        try:
            retrieved = pinecone_client.query(text=request.question, top_k=8)
        except Exception as e:
            log_info(f"   ⚠️  Pinecone query failed: {e}")
            retrieved = []

        # 2) Ask the LLM
        result = chat_module.answer(
            question=request.question,
            current_url=request.current_url,
            current_page_text=request.current_page_text,
            chat_history=[t.model_dump() for t in request.chat_history],
            retrieved=retrieved,
        )

        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_response("/api/chat", 200, elapsed_ms)

        sources = [
            ChatSource(url=s.url, timestamp=s.timestamp, snippet=s.snippet)
            for s in result.sources
        ]
        return ChatResponse(success=True, answer=result.answer, sources=sources)

    except Exception as e:
        elapsed_ms = (time.time() - start) * 1000
        RequestLogger.log_error("/api/chat", e)
        RequestLogger.log_response("/api/chat", 502, elapsed_ms)
        return ChatResponse(success=False, answer=None, sources=[], error=str(e))


@router.get("/")
async def root():
    return {
        "name": "Yukti RAG Chat Server",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "index": "/api/index",
            "chat": "/api/chat",
            "docs": "/docs",
        },
        "status": "running",
    }
```

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest -v 2>&1 | tail -20
```

Expected: all tests still green (we didn't change anything they exercised).

- [ ] **Step 4: Smoke-import to confirm syntax**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. python -c "from api.routes import router; print('routes OK')"
```

Expected: `routes OK`.

- [ ] **Step 5: Commit**

```bash
git add server/models/schemas.py server/api/routes.py
git commit -m "feat(api): replace /api/analyze + /api/action with /api/index + /api/chat"
```

---

### Task 9: Delete the agents, the LangGraph workflow, and `langgraph` from deps

**Files:**
- Delete: `server/agents/` (whole directory)
- Delete: `server/graph/` (whole directory)
- Modify: `server/requirements.txt`
- Modify: `server/main.py` (only if anything still imports from `agents`/`graph` — check first)

- [ ] **Step 1: Verify nothing outside the to-be-deleted dirs imports them**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti && grep -rn "from agents\|import agents\|from graph\|import graph" server/ --include="*.py" | grep -v "server/agents/\|server/graph/\|__pycache__"
```

Expected: no output. If any output appears, fix that file before deleting (most likely `main.py` if it still imports the workflow — earlier tasks should have removed those imports, but verify).

- [ ] **Step 2: Delete the directories**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti && git rm -rf server/agents server/graph
```

- [ ] **Step 3: Drop `langgraph` from `server/requirements.txt`**

Remove this line:
```
langgraph==0.2.45
```

Leave `langchain==0.3.7` and `langchain-core==0.3.15` — they're still used by the factory (`init_chat_model` and `BaseChatModel`).

- [ ] **Step 4: Reinstall to drop the package locally**

```bash
cd server && source .venv/bin/activate && pip uninstall -y langgraph
```

- [ ] **Step 5: Smoke-import the server**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. python -c "from main import app; print('main imports OK')"
```

Expected: `main imports OK`.

- [ ] **Step 6: Run the full test suite**

```bash
cd server && source .venv/bin/activate && PYTHONPATH=. pytest -v 2>&1 | tail -10
```

Expected: all tests green.

- [ ] **Step 7: Commit**

```bash
git add server/requirements.txt
git commit -m "refactor(server): remove agents/, graph/, and langgraph dep"
```

---

### Task 10: Refresh `server/.env.example` for the new config

**Files:**
- Modify: `server/.env.example`

- [ ] **Step 1: Replace `server/.env.example`**

```bash
# ───────────────────────────────────────────────────────────────
# Yukti server configuration
# Copy this file to `.env` and fill in the values for your setup.
# ───────────────────────────────────────────────────────────────

# ── LLM Provider ──
# Provider selection — one of: gemini | openai | groq | mistral
LLM_PROVIDER=gemini

# Provider API keys — set the one matching LLM_PROVIDER; leave others blank
GOOGLE_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=

# Chat model name (must be valid for the active LLM_PROVIDER)
#
# Gemini:
CHAT_MODEL=gemini-2.5-pro
# OpenAI example:    CHAT_MODEL=gpt-4o
# Groq example:      CHAT_MODEL=llama-3.3-70b-versatile
# Mistral example:   CHAT_MODEL=mistral-large-latest

# ── Pinecone (RAG vector store) ──
# Get a key at https://app.pinecone.io
PINECONE_API_KEY=
PINECONE_INDEX_NAME=yukti-interactions
PINECONE_EMBED_MODEL=multilingual-e5-large
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

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
git commit -m "docs(server): refresh .env.example for RAG chat pivot"
```

---

### Task 11: Repoint `background.ts` from `/api/analyze` to `/api/index` and add chat forwarder

**Files:**
- Modify: `yukti/background.ts`

- [ ] **Step 1: Find and replace the sendToServer fetch target**

In `yukti/background.ts`, search for the `fetch(\`${SERVER_URL}/api/analyze\`` call (around line 260) and change `/api/analyze` to `/api/index`:

```diff
     const response = await fetch(`${SERVER_URL}/api/analyze`, {
+    const response = await fetch(`${SERVER_URL}/api/index`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(payload)
     })
```

- [ ] **Step 2: Drop the suggestion-storage write-back**

After the fetch in `sendToServer()`, the code stores `data.suggestions` to `chrome.storage.local.serverSuggestions` (around lines 278-285). Replace the whole "Store suggestions for chatbot to retrieve" block with a single log line:

```diff
-    // Store suggestions for chatbot to retrieve
-    await chrome.storage.local.set({
-      serverSuggestions: {
-        suggestions: data.suggestions || [],
-        lastUpdate: Date.now(),
-        error: null,
-      },
-    })
+    console.log(`✅ Yukti: Indexed ${data.indexed || 0} interactions (skipped ${data.skipped || 0})`)
```

- [ ] **Step 3: Add a chat-forwarding message handler**

Find the existing `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {` block (around line 70). Replace its body with:

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORD_INTERACTION") {
    const interaction = message.data
    if (sender.tab) {
      interaction.tabId = sender.tab.id
      interaction.windowId = sender.tab.windowId
      interaction.tabTitle = sender.tab.title
    }
    recordInteraction(interaction)
    sendResponse({ success: true })
  } else if (message.type === "GET_STATS") {
    getStats().then(sendResponse)
    return true
  } else if (message.type === "ASK_CHAT") {
    // Forward a chat question from the content-script chat panel to the server
    askChat(message.payload).then(sendResponse)
    return true
  }
})
```

(Note: `GET_SUGGESTIONS`, `GET_SERVER_SUGGESTIONS`, and the corresponding handlers are removed.)

- [ ] **Step 4: Add the `askChat` helper near the bottom of the file**

Append before the final closing brace of the file (or after `sendToServer` — anywhere at module scope):

```typescript
interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

interface AskChatPayload {
  question: string
  current_url: string
  current_page_text: string
  chat_history: ChatTurn[]
}

interface ChatSource {
  url: string
  timestamp: number
  snippet: string
}

interface ChatReply {
  success: boolean
  answer: string | null
  sources: ChatSource[]
  error: string | null
}

async function askChat(payload: AskChatPayload): Promise<ChatReply> {
  try {
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return {
        success: false,
        answer: null,
        sources: [],
        error: `Server returned ${response.status}: ${text}`,
      }
    }
    return (await response.json()) as ChatReply
  } catch (e) {
    return {
      success: false,
      answer: null,
      sources: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
```

- [ ] **Step 5: Remove the now-dead `getSuggestions` and `getServerSuggestions` functions**

Search the file for these two function definitions and delete them (including any helper code only they used). They were called by the old GET_SUGGESTIONS/GET_SERVER_SUGGESTIONS handlers that are gone now.

```bash
grep -n "async function getSuggestions\|async function getServerSuggestions" /Users/shivampandey/Documents/GitHub/Yukti/yukti/background.ts
```

Use the line numbers from grep to identify the function bodies and remove them in their entirety.

- [ ] **Step 6: Remove the `serverSuggestions` default from the install listener**

In `chrome.runtime.onInstalled.addListener`, delete the `serverSuggestions: []` line from the defaults dict.

- [ ] **Step 7: Type-check**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/yukti && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add yukti/background.ts
git commit -m "refactor(extension): swap /api/analyze for /api/index; add ASK_CHAT handler"
```

---

### Task 12: Strip the Suggestions tab from the popup

**Files:**
- Modify: `yukti/popup.tsx`

- [ ] **Step 1: Identify what to remove**

Search for the patterns:

```bash
grep -n 'suggestions\|Suggestions\|loadSuggestions\|GET_SUGGESTIONS\|GET_SERVER_SUGGESTIONS' /Users/shivampandey/Documents/GitHub/Yukti/yukti/popup.tsx
```

You'll find:
- `const [suggestions, setSuggestions] = useState<string[]>([])` — delete
- An `async function loadSuggestions()` definition — delete the entire function
- A useEffect (or similar) that calls `loadSuggestions()` — delete
- The `{activeTab === "suggestions" && (...)}` JSX block — delete in its entirety
- A tab button labeled "SUGGESTIONS" in the tab bar — delete that `<button>`

- [ ] **Step 2: Remove each in turn**

For each match grep returned above, delete the surrounding logical block (state hook line, function definition, useEffect, JSX section, tab button). Be careful with the JSX: each tab button is one `<button>` element; each tab panel is one conditional render block.

- [ ] **Step 3: If "suggestions" was the default `activeTab`, change the default**

```bash
grep -n 'useState.*"suggestions"\|useState.*\x27suggestions\x27' /Users/shivampandey/Documents/GitHub/Yukti/yukti/popup.tsx
```

If anything matches, change the default to `"settings"`:

```diff
- const [activeTab, setActiveTab] = useState<TabType>("suggestions")
+ const [activeTab, setActiveTab] = useState<TabType>("settings")
```

If a `TabType` union includes `"suggestions"`, drop that arm too.

- [ ] **Step 4: Type-check**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/yukti && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add yukti/popup.tsx
git commit -m "refactor(extension): remove Suggestions tab from popup"
```

---

### Task 13: Build the chat-panel subcomponents

**Files:**
- Create: `yukti/contents/chat-panel/ChatPanel.tsx`
- Create: `yukti/contents/chat-panel/MessageList.tsx`
- Create: `yukti/contents/chat-panel/MessageBubble.tsx`
- Create: `yukti/contents/chat-panel/Sources.tsx`
- Create: `yukti/contents/chat-panel/ChatInput.tsx`
- Create: `yukti/contents/chat-panel/types.ts`

- [ ] **Step 1: Create the shared types file**

`yukti/contents/chat-panel/types.ts`:

```typescript
export type Role = "user" | "assistant" | "system"

export interface ChatSource {
  url: string
  timestamp: number
  snippet: string
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  sources?: ChatSource[]
  isError?: boolean
}
```

- [ ] **Step 2: Create `Sources.tsx`**

```typescript
import { useState } from "react"
import type { ChatSource } from "./types"

interface Props {
  sources: ChatSource[]
}

export default function Sources({ sources }: Props) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  return (
    <div style={{ marginTop: 8, fontSize: 11 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          color: "#06b6d4",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
          fontSize: 11,
        }}>
        {open ? "▾" : "▸"} Sources ({sources.length})
      </button>
      {open && (
        <ul style={{ listStyle: "none", padding: "6px 0 0 12px", margin: 0 }}>
          {sources.map((s, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#10b981", textDecoration: "none" }}>
                {new URL(s.url).hostname}
              </a>
              <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                — {s.snippet}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `MessageBubble.tsx`**

```typescript
import type { ChatMessage } from "./types"
import Sources from "./Sources"

interface Palette {
  bg: string
  fg: string
  border?: string
}

const COLORS: Record<"user" | "assistant" | "error", Palette> = {
  user: { bg: "#0e7490", fg: "#f0f9ff" },
  assistant: { bg: "#1e293b", fg: "#e2e8f0", border: "#334155" },
  error: { bg: "#7f1d1d", fg: "#fecaca", border: "#991b1b" },
}

interface Props {
  message: ChatMessage
}

export default function MessageBubble({ message }: Props) {
  const palette: Palette = message.isError
    ? COLORS.error
    : message.role === "user"
      ? COLORS.user
      : COLORS.assistant

  return (
    <div
      style={{
        display: "flex",
        justifyContent: message.role === "user" ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 12px",
          background: palette.bg,
          color: palette.fg,
          border: palette.border ? `1px solid ${palette.border}` : "none",
          borderRadius: 4,
          fontSize: 13,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
        {message.content}
        {message.role === "assistant" && !message.isError && (
          <Sources sources={message.sources || []} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `MessageList.tsx`**

```typescript
import { useEffect, useRef } from "react"
import type { ChatMessage } from "./types"
import MessageBubble from "./MessageBubble"

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
}

export default function MessageList({ messages, isLoading }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isLoading])

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 12,
        background: "#0f172a",
      }}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {isLoading && (
        <div style={{ padding: "4px 12px", color: "#94a3b8", fontSize: 12 }}>
          Yukti is thinking…
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
```

- [ ] **Step 5: Create `ChatInput.tsx`**

```typescript
import { useState, type KeyboardEvent } from "react"

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export default function ChatInput({ disabled, onSend }: Props) {
  const [text, setText] = useState("")

  const submit = () => {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 8,
        borderTop: "2px solid #334155",
        background: "#1e293b",
      }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Waiting…" : "Ask anything…"}
        disabled={disabled}
        rows={2}
        style={{
          flex: 1,
          padding: 8,
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 4,
          fontSize: 13,
          fontFamily: "inherit",
          resize: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        style={{
          padding: "0 16px",
          background: disabled || !text.trim() ? "#475569" : "#06b6d4",
          color: "#0f172a",
          border: "2px solid #0891b2",
          fontWeight: "bold",
          fontSize: 12,
          cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
        }}>
        {disabled ? "…" : "SEND"}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create `ChatPanel.tsx`**

```typescript
import type { ChatMessage } from "./types"
import MessageList from "./MessageList"
import ChatInput from "./ChatInput"

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (text: string) => void
  onClose: () => void
}

export default function ChatPanel({ messages, isLoading, onSend, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 380,
        height: 560,
        background: "#0f172a",
        border: "3px solid #06b6d4",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        fontFamily: "ui-monospace, monospace",
        color: "#e2e8f0",
      }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#1e293b",
          borderBottom: "2px solid #334155",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontWeight: "bold", color: "#06b6d4", letterSpacing: 1 }}>
            YUKTI
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 18,
            padding: "0 4px",
          }}>
          ×
        </button>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput disabled={isLoading} onSend={onSend} />
    </div>
  )
}
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/yukti && npx tsc --noEmit
```

Expected: no errors. (These components import each other but aren't referenced from the rest of the codebase yet — that comes in Task 14.)

- [ ] **Step 8: Commit**

```bash
git add yukti/contents/chat-panel/
git commit -m "feat(extension): add chat-panel UI subcomponents"
```

---

### Task 14: Rewrite `chatbot-float.tsx` — bubble click expands into the chat panel

**Files:**
- Modify: `yukti/contents/chatbot-float.tsx`

- [ ] **Step 1: Replace the file's contents**

`yukti/contents/chatbot-float.tsx`:

```typescript
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, type MouseEvent } from "react"
import RobotIcon from "~components/RobotIcon"
import ChatPanel from "./chat-panel/ChatPanel"
import type { ChatMessage, ChatSource } from "./chat-panel/types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
}

const BUBBLE_SIZE = 64
const PAGE_TEXT_LIMIT = 3000  // chars sent to /api/chat as current_page_text

interface ChatReply {
  success: boolean
  answer: string | null
  sources: ChatSource[]
  error: string | null
}

const FloatingChatbot = () => {
  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - BUBBLE_SIZE - 16 : 0,
    y: typeof window !== "undefined" ? window.innerHeight - BUBBLE_SIZE - 16 : 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [didDrag, setDidDrag] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — ask me anything about the page you're on, or about anything you've browsed.",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)

  // ── drag ──────────────────────────────────────────────────────────
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    setDidDrag(false)
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: globalThis.MouseEvent) => {
      setDidDrag(true)
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isDragging, dragOffset])

  // ── bubble click toggle ──────────────────────────────────────────
  const onBubbleClick = () => {
    if (didDrag) return  // suppress click after a drag
    setIsOpen((v) => !v)
  }

  // ── chat send ────────────────────────────────────────────────────
  const onSend = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    }
    // Build the history payload BEFORE appending this turn (server includes it as past context)
    const history = messages
      .filter((m) => m.id !== "welcome" && !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((m) => [...m, userMsg])
    setIsLoading(true)

    const pageText = extractPageText().slice(0, PAGE_TEXT_LIMIT)

    try {
      const reply: ChatReply = await chrome.runtime.sendMessage({
        type: "ASK_CHAT",
        payload: {
          question: text,
          current_url: window.location.href,
          current_page_text: pageText,
          chat_history: history,
        },
      })
      const botMsg: ChatMessage = reply.success && reply.answer
        ? {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: reply.answer,
            sources: reply.sources || [],
          }
        : {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: reply.error || "Sorry, I couldn't get an answer.",
            isError: true,
          }
      setMessages((m) => [...m, botMsg])
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content:
            e instanceof Error
              ? `Couldn't reach Yukti: ${e.message}`
              : "Couldn't reach Yukti.",
          isError: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // ── render ───────────────────────────────────────────────────────
  return (
    <>
      <div
        onMouseDown={onMouseDown}
        onClick={onBubbleClick}
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          cursor: isDragging ? "grabbing" : "grab",
          zIndex: 2147483646,
          userSelect: "none",
        }}>
        <RobotIcon />
      </div>
      {isOpen && (
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={onSend}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

/** Extract visible page text. Synchronous, content-script context. */
function extractPageText(): string {
  // Prefer the <main> if present; fall back to document.body
  const main = document.querySelector("main")
  const root = main ?? document.body
  if (!root) return ""
  return (root.innerText || "").replace(/\s+/g, " ").trim()
}

export default FloatingChatbot
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/yukti && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build the extension**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/yukti && npm run build 2>&1 | tail -3
```

Expected: `🟢 DONE   | Finished in <ms>ms!`

- [ ] **Step 4: Commit**

```bash
git add yukti/contents/chatbot-float.tsx
git commit -m "feat(extension): rewrite floating chatbot to open chat panel on click"
```

---

### Task 15: Manual smoke test (USER action — no commit)

This is the end-to-end verification. No code changes — just confirm the new chat flow works against a real Pinecone + LLM.

- [ ] **Step 1: Configure `.env`**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/server
# .env should have:
#   LLM_PROVIDER=<your provider>
#   <PROVIDER>_API_KEY=<real key>
#   CHAT_MODEL=<provider-appropriate model>
#   PINECONE_API_KEY=<real Pinecone key>
```

- [ ] **Step 2: Start the server**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/server
source .venv/bin/activate
PYTHONPATH=. uvicorn main:app --host 0.0.0.0 --port 8000
```

Expected: startup logs show `Pinecone index: yukti-interactions (multilingual-e5-large)` and `LLM Provider: <yours>`. No tracebacks.

- [ ] **Step 3: Rebuild + reload the extension**

```bash
cd /Users/shivampandey/Documents/GitHub/Yukti/yukti && npm run build
```

Then in Chrome `chrome://extensions/` → Yukti → **↻ reload**.

- [ ] **Step 4: Generate interactions**

Browse 3-4 pages, do some clicks and scrolling, type into a search box. After ~30 interactions, the server log should show:

```
📥 POST /api/index
   Indexed: N, skipped: M
```

(Where M will include the scrolls that were skipped.)

- [ ] **Step 5: Open the chat panel**

Click the floating robot icon on any page. The panel should expand from the bubble (380×560 px, anchored bottom-right area).

- [ ] **Step 6: Test the live-page path**

Ask: **"What page am I on right now?"**
Expected: an answer that names the current site/page. This proves the `current_page_text` path works.

- [ ] **Step 7: Test the RAG path**

Ask: **"What was I looking at a few minutes ago?"** or **"What was the last thing I searched for?"**
Expected: an answer that references something from earlier in the session. Server log shows top_k=8 Pinecone hits. Sources chip on the assistant message shows URLs.

- [ ] **Step 8: Test the error path**

Stop the server (Ctrl-C). Ask another question.
Expected: red error bubble: "Couldn't reach Yukti…". Conversation history stays.

Restart the server, ask a follow-up — verify multi-turn coherence (the LLM references the prior conversation).

- [ ] **Step 9: Report**

If all 8 steps pass, the pivot is complete. If any step fails, paste the relevant log line back so we can debug.

---

## Spec coverage check (self-review)

| Spec section | Task(s) |
|---|---|
| New `rag/` package: formatter, pinecone_client, chat | Tasks 5, 6, 7 |
| Pinecone setup with integrated embeddings + `multilingual-e5-large` | Task 6 |
| Per-interaction vectors, scroll skipped, idempotent IDs | Task 5 |
| `/api/index` endpoint replaces `/api/analyze` | Task 8 |
| `/api/chat` endpoint with current page + history + RAG | Tasks 7, 8 |
| Delete `agents/`, `graph/`, drop `langgraph` | Task 9 |
| Narrow `llm/factory.py` to single `"chat"` role | Task 3 |
| `validate_settings` requires `PINECONE_API_KEY` | Task 4 |
| Settings: add `pinecone_*` + `chat_model`, drop 3 agent models | Task 2 |
| Test seams: formatter, pinecone_client, chat, factory chat role, settings, validate | Tasks 2-7 |
| `chatbot-float.tsx` expands into chat panel | Task 14 |
| Chat panel UI: ChatPanel / MessageList / MessageBubble / Sources / ChatInput | Task 13 |
| `background.ts` retargets `/api/analyze` → `/api/index`, adds `ASK_CHAT` forwarder | Task 11 |
| Strip Suggestions tab from popup | Task 12 |
| `.env.example` updated for Pinecone + chat_model | Task 10 |
| End-to-end smoke plan | Task 15 |

Out-of-scope items from the spec (streaming, tool-use, server-side conversation persistence, backfill of pre-pivot interactions, Chrome side-panel, multi-user namespacing) are intentionally not in this plan.
