# RAG + Chat Pivot — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation plan
**Scope:** `server/` rewrite + `yukti/` extension rewrite. Existing multi-LLM provider factory is preserved unchanged.

## Goal

Replace the proactive 3-agent suggestion pipeline with an on-demand chat assistant grounded in the user's own browsing history (via Pinecone RAG) plus the live page they're viewing.

## Product change in one paragraph

Today: extension batches every 30 interactions → server runs Context Builder → Intent Analyzer → Suggestion → returns one unsolicited tip → popup shows it. After this change: extension still tracks and batches interactions, but sends them to `/api/index` to be vectorized into Pinecone. The user clicks the floating bot icon, which expands into a chat panel. They ask anything (about the current page or about their history). Server retrieves top-K interactions from Pinecone, combines them with the current page's DOM text and the recent chat history, and the configured LLM answers.

## Decisions (pinned during brainstorming)

| Question | Decision |
|---|---|
| Fate of the 3-agent suggestion pipeline? | **Delete entirely.** Chat is the only mode. |
| What's one Pinecone document? | **One vector per interaction** (raw event), with surrounding context (URL, tab title, formatted timestamp) embedded into the values_text so each event is meaningfully embeddable. |
| Where does the chat UI live? | **Expand the existing `chatbot-float.tsx` floating bubble into a chat panel.** Stays on-page. |
| Embeddings provider? | **Pinecone integrated embeddings** (their hosted inference, model `multilingual-e5-large`). Server upserts text + metadata; Pinecone embeds server-side. |
| Indexing trigger? | **Eager** — reuse the existing 30-interaction batch + 15s cooldown + single-flight from `background.ts`, just retarget the POST to `/api/index`. |
| Current-page Q&A grounding? | **Live DOM extraction** at chat-time (existing `GET_PAGE_CONTENT` content-script path). Always-fresh, not stale. |
| Chat history (multi-turn)? | **Last 6 turns**, owned by the chat panel's React state. Ephemeral — closing the panel/navigating resets it. |
| Retrieval depth? | **top_k = 8** Pinecone hits per query. |
| Streaming responses? | **No** in v1. Plain JSON. Panel shows a spinner. |
| Source citations? | **Yes** — assistant messages render a collapsible "Sources (N)" chip with URLs + timestamps + snippets. |
| Scroll events? | **Indexed: no.** Pure noise without page content. Still recorded in `chrome.storage.local` for stats. |
| Retroactive backfill of old `chrome.storage.local` interactions? | **No** in v1. Forward-fill only. Existing data stays un-indexed. |
| Pinecone credentials? | **Server-side .env** only. No client key path. |
| Index auto-provision? | **Yes.** Server creates the index on first startup if missing. |
| Embedding-failure & 429 retries / fallback providers? | **None** in v1. Errors surface to the panel as a red system message. |

## Approach: Two endpoints, eager indexing

`POST /api/index` and `POST /api/chat`. Indexing path is silent (extension fire-and-forget), chat path is interactive (panel shows result). Old `/api/analyze` and `/api/action` are deleted.

**Why not lazy indexing on chat-open:** first chat after a long browsing session would take 10+ seconds. Server load spikes. Bad UX.

**Why not a single endpoint that does both:** couples concerns. If the user is idle but interactions accumulate, they don't get indexed. If they want to chat about old data, the request still ships latest interactions. Worst of both.

## File layout

```
server/
  api/
    routes.py                # REWRITE: drop /api/analyze + /api/action; add /api/index, /api/chat
  rag/                       # NEW package
    __init__.py
    pinecone_client.py       # ensure_index() / upsert_texts() / query()
    formatter.py             # interaction dict → embeddable text string
    chat.py                  # assemble RAG context + LLM call, return answer + sources
  agents/                    # DELETE entire directory
  graph/                     # DELETE entire directory
  models/schemas.py          # REWRITE: drop Analyze*/Action*; add IndexRequest/Response, ChatRequest/Response
  config/settings.py         # EXTEND: pinecone_* fields, chat_model, drop the 3 agent model fields
  llm/                       # UNCHANGED (multi-provider factory still used by chat.py)
  tests/
    test_formatter.py        # NEW
    test_pinecone_client.py  # NEW (uses a fake Pinecone via monkeypatch)
    test_chat.py             # NEW (assemble prompt with fake retrieval results)
    test_llm_factory.py      # KEEP — needs to add a "chat" role test
    test_providers.py        # KEEP
    test_settings_fields.py  # UPDATE — drop agent model fields, add pinecone + chat_model
    test_validate_settings.py # UPDATE — add Pinecone key check
    conftest.py              # UPDATE — stub PINECONE_API_KEY too

yukti/
  background.ts              # MODIFY: sendToServer() target → /api/index; drop suggestion paths
  contents/chatbot-float.tsx # MAJOR REWRITE: bubble click expands to chat panel
  contents/chat-panel/       # NEW
    ChatPanel.tsx
    MessageList.tsx
    MessageBubble.tsx
    Sources.tsx
    ChatInput.tsx
  popup.tsx                  # MODIFY: remove Suggestions tab
  components/RobotIcon.tsx   # KEEP
```

## Component boundaries

### `server/rag/pinecone_client.py`
**Public surface:**
- `ensure_index() -> None` — idempotent; creates the index with integrated embeddings if missing
- `upsert_texts(records: list[dict]) -> dict` — each record `{id, values_text, metadata}`; returns counts
- `query(text: str, top_k: int = 8, filters: dict | None = None) -> list[QueryHit]`

Knows nothing about agents, FastAPI, or interaction shapes. Only Pinecone.

### `server/rag/formatter.py`
**Public surface:**
- `format(interaction: dict) -> FormattedRecord | None` — returns `None` if the event should be skipped (e.g. scroll). Otherwise `{id, values_text, metadata}` ready for upsert.

Pure function. No I/O.

### `server/rag/chat.py`
**Public surface:**
- `answer(question: str, current_url: str, current_page_text: str, chat_history: list[dict], retrieved: list[QueryHit]) -> ChatAnswer`

Knows how to assemble a prompt and call `get_llm("chat")`. Returns answer text + structured sources.

### `server/api/routes.py`
Stays thin: parse request → call `formatter.format` + `pinecone_client.upsert_texts` (for index) OR `pinecone_client.query` + `chat.answer` (for chat) → return response.

### `yukti/contents/chatbot-float.tsx`
Orchestrator: drag/position the bubble, toggle expanded state, render either the bubble or the `<ChatPanel>`. Owns the chat-state React hooks (messages, isLoading, error). Sends requests via `chrome.runtime.sendMessage({type: "ASK_CHAT", payload})` to background.ts which forwards to the server.

### `yukti/contents/chat-panel/`
Pure-presentational React components, no chrome.* calls. Take props, render UI, fire callbacks. Easy to test in isolation if we ever stand up a Plasmo test harness.

## Pinecone setup & data model

### Index config (created on startup if missing)

```python
pinecone_client.create_index_for_model(
    name=settings.pinecone_index_name,            # default: "yukti-interactions"
    cloud=settings.pinecone_cloud,                # default: "aws"
    region=settings.pinecone_region,              # default: "us-east-1"
    embed={
        "model": settings.pinecone_embed_model,   # default: "multilingual-e5-large"
        "field_map": {"text": "values_text"},
    },
)
```

### Per-vector payload

```json
{
  "id": "<sha1(canonical_key)>",
  "values_text": "Clicked button 'Apply now' on workatastartup.com (Sun Jun 7 2026, 13:08)",
  "metadata": {
    "type": "click",
    "url": "https://workatastartup.com/companies?query=AI",
    "tab_title": "Companies — Work at a Startup",
    "timestamp": 1717764493000,
    "element_text": "Apply now",
    "element_type": "button",
    "scroll_depth": null,
    "input_value": null,
    "input_name": null
  }
}
```

### values_text templates per event type

| Event type | values_text shape |
|---|---|
| `click` | `Clicked {elementType} '{elementText}' on {hostname} ({formatted_date})` |
| `navigation` | `Visited {tab_title} at {hostname} ({formatted_date})` |
| `input_value` | `Typed '{inputValue}' into {inputName} on {hostname} ({formatted_date})` |
| `form_interaction` | `Focused {inputName} field on {hostname} ({formatted_date})` |
| `scroll` | **skipped — not indexed** |
| `tab_activated` / others | `User activity ({type}) on {hostname} ({formatted_date})` — generic fallback |

`formatted_date` = `Sun Jun 7 2026, 13:08` style — readable, embeddable, queryable by phrasing like "yesterday".

### Deduplication

`id = sha1("|".join([type, url, str(timestamp_ms // 1000), elementText or "", inputValue or ""]))`. Second-resolution timestamp + canonical fields → re-sending the same batch (network retry) upserts the same IDs (no-op). Pinecone's upsert is idempotent on ID.

### Scale budget

After dropping scrolls: ~50 indexed events/day × 365 = ~18 k vectors/year. Pinecone serverless free tier handles 5 M+. Plenty of headroom.

## Data flow

### Indexing (silent, fire-and-forget)

```
[user interaction]
    ↓
recordInteraction()                background.ts (unchanged)
    ↓ chrome.storage.local
checkAndSendBatch()                every 30 interactions, 15s cooldown, single-flight
    ↓
sendToServer() → POST /api/index   (was /api/analyze)
    body: {
      interactions: [last 50 events from storage],
      current_url, tab_id
    }
        ↓
        for event in interactions:
            record = formatter.format(event)
            if record is None: skip   # scrolls etc.
            collect record
        ↓
        pinecone_client.upsert_texts(records)
        ←  {indexed: N, skipped: M, duplicates: D}
```

The extension logs the response to console but doesn't act on it. The 15-second cooldown still applies — indexing isn't time-critical and Pinecone serverless is rate-limited.

### Chat (interactive)

```
[user clicks bot → panel expands → types question → Send]
    ↓
chatbot-float.tsx
    1. ask the active tab for current page DOM:
       chrome.tabs.sendMessage(tabId, {type: "GET_PAGE_CONTENT"})
       (handler already exists in behavior-monitor.ts)
    2. POST via background.ts → POST /api/chat
       body: {
         question, current_url, current_page_text,
         chat_history: [last 6 turns from React state]
       }
        ↓
        retrieved = pinecone_client.query(text=question, top_k=8)
        ↓
        chat.answer(question, current_url, current_page_text, chat_history, retrieved)
            ↓ get_llm("chat")
            ↓ system: "You are Yukti, a personal browser-history assistant.
                       Answer based on the user's tracked interactions and
                       the current page. Cite URLs when relevant. If you
                       don't have evidence, say so — don't fabricate."
            ↓ user: assembled prompt (template in chat.py)
        ←   {answer, sources: [{url, timestamp, snippet}, ...]}
    ↓
panel renders the assistant bubble + collapsible sources
```

### Prompt template (chat.py)

```
[CURRENT PAGE: {current_url}]
{current_page_text[:3000]}

[YOUR BROWSING HISTORY — relevant interactions]
{retrieved_context}

[CONVERSATION SO FAR]
{chat_history_formatted}

[QUESTION]
{question}
```

`retrieved_context` is the top 8 `values_text` strings joined by `\n`, each prefixed with timestamp so the LLM can reason about recency.

## UI: floating panel expansion

### Layout — collapsed bubble (State 1)

Unchanged from today. Draggable robot icon, ~64×64, bottom-right by default. Hover glow. Click expands to State 2.

### Layout — chat panel (State 2)

380×560 px, anchored where the bubble was. Pixel-art aesthetic matching the landing page (dark slate background, cyan/green accents, chunky borders).

```
┌─────────────────────────────────────────┐
│ [🤖] YUKTI                       [×]    │  header, 48px
├─────────────────────────────────────────┤
│                                          │
│  [Yukti] Hi — ask me about anything      │  message list, scrolls
│         you've browsed or this page.     │
│                                          │
│  [You]   what was that startup           │
│          I looked at yesterday?          │
│                                          │
│  [Yukti] You were on workatastartup.com  │
│         on Jun 6 viewing "AI Engineer"   │
│         listings...                      │
│         ▾ Sources (3)                    │
│           • workatastartup.com — Jun 6   │
│           • cutshort.io — Jun 6          │
│           • news.ycombinator.com — Jun 5 │
│                                          │
├─────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌────────┐  │  input row, 56px
│ │ Ask anything...         │ │ SEND   │  │
│ └─────────────────────────┘ └────────┘  │
└─────────────────────────────────────────┘
```

### Interaction rules

- **Enter** sends; **Shift+Enter** newlines.
- During request: header bot icon pulses, Send shows spinner, input disabled.
- Network/server errors → red system bubble; conversation state preserved.
- Drag works on the bubble only (State 1); panel is anchored.
- On hard navigation while panel is open: panel closes (content script reloads, React state lost). Acceptable for v1.
- **Sources display:** each assistant message renders a collapsible chip "Sources (N)". Expanded: bullet list of URL + formatted timestamp + first 80 chars of values_text snippet.

### Subcomponent split

| File | Responsibility |
|---|---|
| `ChatPanel.tsx` | Container; layout grid; receives messages[]/isLoading/onSend |
| `MessageList.tsx` | Scrollable virtualized list of `MessageBubble` |
| `MessageBubble.tsx` | One bubble: avatar, content, sources (if assistant) |
| `Sources.tsx` | Collapsible source list under an assistant message |
| `ChatInput.tsx` | Textarea + Send button + Enter/Shift+Enter handling |

Splitting now because chat UIs grow tentacles fast (typing indicator, retry, copy-message, regenerate, etc.). Each file stays under 100 LoC.

## Configuration: settings.py additions

```python
# Pinecone
pinecone_api_key:     str = ""
pinecone_index_name:  str = "yukti-interactions"
pinecone_embed_model: str = "multilingual-e5-large"
pinecone_cloud:       str = "aws"
pinecone_region:      str = "us-east-1"

# Per-role model — replaces the three agent-specific model fields
chat_model: str = "mistral-large-latest"  # provider-specific default in .env.example
```

**Removed fields:** `context_builder_model`, `analyzer_model`, `suggestion_model`.

**`validate_settings()` additions:**
- Raise `ValueError` if `pinecone_api_key` is empty
- (Existing LLM-provider key check unchanged)

**`.env.example` updates:**
- Add `PINECONE_API_KEY=`, `PINECONE_INDEX_NAME=yukti-interactions`, `PINECONE_EMBED_MODEL=multilingual-e5-large`
- Replace the three model lines with `CHAT_MODEL=<provider-default>`
- Examples per provider commented inline (mistral-large-latest / gpt-4o / llama-3.3-70b-versatile / gemini-2.5-pro)

## Error handling

| Layer | Failure | Behavior |
|---|---|---|
| Server startup | `PINECONE_API_KEY` missing | Hard-fail with clear message naming env var |
| Server startup | Pinecone unreachable / auth fails | Server exits with Pinecone error verbatim |
| Server startup | Index doesn't exist | Auto-create via `pinecone_client.ensure_index()`; on failure, exit |
| `/api/index` | Upsert fails | Return 502 `{indexed: 0, error: "..."}`. Extension logs and drops the batch. Next batch catches up because IDs are deterministic |
| `/api/chat` retrieval | Pinecone query fails | Server logs, continues with empty retrieved_context. User still gets an answer about the current page |
| `/api/chat` LLM | 429 / 5xx | Return 502 `{answer: null, error: "..."}`. Panel renders red system bubble |
| Extension network | Server down | Same red bubble: "Couldn't reach Yukti at localhost:8000" |
| Extension permissions | DOM blocked (chrome://, file://) | Empty `current_page_text`. Server proceeds with RAG-only. UI: "Couldn't read this page; using your browsing history." |

**Non-goals:** retries, streaming, fallback provider chain, conversation persistence on the server.

## Testing

Same minimal posture as the multi-LLM work — test the new seams.

### `server/tests/test_formatter.py`

```python
def test_click_with_text_formats_readable():
    record = format({"type": "click", "url": "https://workatastartup.com/jobs",
                     "elementText": "Apply now", "elementType": "button",
                     "timestamp": 1717764493000})
    assert "Clicked button 'Apply now'" in record.values_text
    assert "workatastartup.com" in record.values_text

def test_scroll_returns_none():
    assert format({"type": "scroll", "scrollDepth": 75}) is None

def test_null_fields_dont_crash():
    record = format({"type": "click", "url": "https://example.com",
                     "elementText": None, "elementType": None,
                     "timestamp": 1717764493000})
    assert record is not None  # fallback to generic format
```

### `server/tests/test_pinecone_client.py`

Monkeypatch `pinecone.Pinecone` and `pinecone.PineconeAsyncio` with fakes. Assert:
- `ensure_index()` is idempotent (no error when called twice)
- `upsert_texts()` sends the expected records
- `query()` returns parsed `QueryHit` objects from a stubbed response

### `server/tests/test_chat.py`

```python
def test_answer_includes_page_text_and_retrieved_context(monkeypatch):
    fake_llm = FakeLLM(response="OK")
    monkeypatch.setattr("rag.chat.get_llm", lambda role: fake_llm)
    out = answer(question="x", current_url="https://...",
                 current_page_text="page body",
                 chat_history=[], retrieved=[hit("..."), hit("...")])
    assert "page body" in fake_llm.last_prompt
    assert "[YOUR BROWSING HISTORY" in fake_llm.last_prompt
    assert isinstance(out.sources, list)
```

### Existing tests touched

- `test_llm_factory.py` — add a parametrized "chat" role assertion
- `test_settings_fields.py` — drop the three agent model field tests; add chat_model + pinecone_* tests
- `test_validate_settings.py` — add a "missing PINECONE_API_KEY raises" test
- `conftest.py` — set `PINECONE_API_KEY=test-stub-key` and `LLM_PROVIDER=gemini` env defaults

### Not tested (and why)

- Real Pinecone network calls — slow, costs money, flaky
- LLM round-trips — already covered by factory shape tests
- Extension UI — no Plasmo test setup; relies on manual smoke

### Manual smoke test plan

1. Set valid `PINECONE_API_KEY` + `LLM_PROVIDER` + provider key in `.env`. Start server. Watch logs for `Pinecone index ready: yukti-interactions`.
2. Reload extension. Browse for 30+ interactions. Watch server logs for `POST /api/index → 200 (N indexed)`.
3. Click the floating bot → confirm it expands into the chat panel.
4. Ask "what page am I on?" — confirm answer references the live page (verifies `current_page_text` path).
5. Ask "what was I looking at yesterday?" — confirm answer references something from RAG (verifies `pinecone.query` path).
6. Disconnect network, send a question → red error bubble, panel stays open.
7. Reconnect, continue the conversation — multi-turn coherence works.

## Migration — what gets deleted

### Server
- `server/agents/` (whole dir)
- `server/graph/` (whole dir)
- `server/api/routes.py` — `/api/analyze` and `/api/action` handlers
- `server/models/schemas.py` — `AnalyzeRequest`, `AnalyzeResponse`, `ActionRequest`
- `server/llm/factory.py` — `ROLE_CONFIG` entries for `"context_builder"`, `"analyzer"`, `"suggestion"` are removed; only `"chat"` remains. The `Role` Literal narrows to `Literal["chat"]`.
- `requirements.txt` — drop `langgraph`. Keep `langchain-core` and the provider packages

### Extension
- `yukti/background.ts` — `getSuggestions()`, `getServerSuggestions()`, `serverSuggestions` chrome.storage key, `GET_SERVER_SUGGESTIONS` message handler, suggestion polling
- `yukti/popup.tsx` — Suggestions tab + supporting state (`suggestions`, `loadSuggestions()`, polling)

### No data migration

Orphan `chrome.storage.local.suggestions` / `serverSuggestions` keys are harmless — just leave them. The next clean install starts fresh.

## Out of scope

- Streaming responses
- Tool-use / function-calling in chat
- Conversation persistence on server (chat history is panel-owned, ephemeral)
- Backfill of pre-pivot `chrome.storage.local` interactions
- Per-tab chat session persistence
- Source-citation deep-linking (clicking a source jumps to that URL — could be added trivially in v1.1)
- Embedding choice beyond Pinecone-hosted (no Cohere, OpenAI embeddings, local models)
- Multi-user / namespaced indexes
- CI / broader test infrastructure
- `INTEGRATION_GUIDE.md` update (already stale; separate cleanup)

## Open items for the implementation plan

- Resolve `pinecone-client` Python SDK version (latest at plan-time that supports the `create_index_for_model` integrated-embeddings path)
- Decide if `langchain-core` can be dropped entirely or stays as the chat-model interface (likely stays — `init_chat_model` lives in `langchain`, returns a `BaseChatModel` from `langchain-core`)
- Confirm Pinecone serverless free-tier region/cloud combination works for the user (default `aws/us-east-1` is the most reliable)
- Whether to expose the chat panel via the toolbar popup as a fallback for `chrome://` pages where content scripts can't inject
