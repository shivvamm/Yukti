# Tier 1: Trust & Recall — Design Spec

**Date:** 2026-06-11
**Status:** Approved (pending spec review)
**Scope:** Four client-and-server components that make Yukti credible as a product:
consent-first onboarding, a controllable memory browser, better retrieval, and
streaming answers.

---

## 1. Purpose

Yukti's pitch is "private personal memory for your browser." Today the extension
tracks immediately on install, offers no first-run consent, gives users no
searchable/deletable view of what is remembered, indexes noisy near-duplicate
interactions, and replies in one blocking shot. Tier 1 closes those gaps so the
privacy/recall story is *credible* and the product *feels* finished.

## 2. Decisions (locked)

| Decision | Choice |
|----------|--------|
| Consent model | **Consent-first** — nothing tracked until the user accepts |
| Onboarding placement | **Dedicated page** opened on install |
| Memory-browser delete scope | **Local + server vector** (true deletion) |
| Streaming | **Wire now with graceful fallback** to the existing one-shot path |

## 3. Components

### 3.1 Onboarding + consent-first gate

**Storage (new / changed flags in `chrome.storage.local`):**
- `onboarded: boolean` — default `false`.
- `trackingEnabled: boolean` — default **`false`** (today it defaults `true`).

**Install hook (`background.ts`):**
- In `chrome.runtime.onInstalled`, when `details.reason === "install"`, open a
  dedicated onboarding page: `chrome.tabs.create({ url: chrome.runtime.getURL("tabs/onboarding.html") })`.
- Default settings are still seeded on install, but with `trackingEnabled: false`
  and `onboarded: false`.

**Onboarding page (`tabs/onboarding.tsx`, new — Plasmo serves it at `tabs/onboarding.html`):**
- Steps: Welcome → "What Yukti remembers" (the five existing categories, each with
  a toggle bound to the `disable*` flags) → privacy explainer (local-first, per-install
  UUID, password/payment fields never tracked) → action buttons.
- **Accept & enable** → `{ onboarded: true, trackingEnabled: true }`.
- **Stay paused** → `{ onboarded: true, trackingEnabled: false }` (can enable later
  from the popup).
- Reuses `~theme` tokens and the existing `RobotIcon` / `SpikeMark` components for
  visual consistency with the popup.

**Enforcement (authoritative gate):**
- `recordInteraction()` in `background.ts` gains a hard gate at the very top:
  `if (!trackingEnabled) return`. This is the single source of truth — it runs
  before storage writes and before batch sends, so a paused state tracks nothing.
- `trackingEnabled` is read alongside the other flags already fetched in
  `recordInteraction`'s `storage.local.get([...])` call.
- **To confirm during planning:** how `contents/behavior-monitor.ts` currently
  reads `trackingEnabled` (it listens for `TRACKING_STATUS_CHANGED`); ensure the
  content script also respects the off state so it stops emitting events, not just
  relying on the background drop. Background gate is authoritative regardless.

**Popup:** the Home/Settings tabs surface a master "Tracking: on/paused" control
bound to `trackingEnabled`, so users can flip the consent decision after onboarding.

### 3.2 Memory Browser

**Goal:** a searchable, filterable, per-item-deletable view of what Yukti remembers,
replacing the current read-only accordion in the popup's Data tab.

**UI (popup `Data` tab):**
- Search box — case-insensitive substring match over host, tab title, and
  `elementText`.
- Date-range filter — `Today | 7 days | 30 days | All` (operates on
  `interaction.timestamp`).
- A flat, reverse-chronological list of remembered items. Each row: time, type,
  host/title, a short snippet, and a **delete ×** button.
- Empty state preserved.

**Data source:** the existing local `interactions[]` (and `interactionsByTab`)
already in `chrome.storage.local`. No server round-trip to render.

**Per-item delete (local + server):**
- Local: remove the item from `interactions[]` and from the matching
  `interactionsByTab[tab].dates[date][]`, persist, re-render.
- Server: POST the raw interaction to a **new `/api/forget-item`** endpoint.
  - Server runs the interaction back through `rag.formatter.format()` to
    reconstruct the **same deterministic SHA1 `_id`** that was used at index time,
    then calls `index.delete(ids=[id], namespace=...)`.
  - **Why this design:** delete-by-id works on serverless Pinecone, whereas
    delete-by-metadata-filter does not. Reconstructing the id from the raw
    interaction avoids the serverless limitation entirely and reuses existing
    formatting logic (single source of truth for ids).
  - If `format()` returns `None` (interaction was never indexed, e.g. a scroll),
    the server no-ops and returns success.
- Best-effort: if the server is unreachable, the local delete still succeeds; the
  vector is reclaimable later via bulk "Delete all".

**Server additions:**
- `models/schemas.py`: `ForgetItemRequest { user_id: str, interaction: dict }`,
  reuse `ForgetResponse`.
- `rag/pinecone_client.py`: `delete_ids(ids: list[str])` wrapper.
- `api/routes.py`: `POST /api/forget-item` (rate-limited), formats → id → delete.

### 3.3 Better retrieval

**Client-side dedup before indexing (`background.ts`):**
- Before adding an interaction to the send batch, suppress it if an equivalent one
  (same `url` + `type` + `elementText`) was already recorded within a short window
  (default 5 minutes). Implemented as an in-memory recent-key set with timestamps,
  or a check against the tail of `interactions[]`.
- Effect: stops indexing near-identical repeats (re-clicks, re-visits), cutting
  vector bloat and improving retrieval precision. No deploy needed.
- Note: the formatter's deterministic ids already collapse *exact* duplicates at
  upsert time; this handles *near* duplicates and saves the network/embedding cost.

**Optional date-range filter in retrieval (server):**
- `pinecone_client.query()` accepts an optional `time_range: tuple[int, int] | None`
  and, when present, ANDs a `timestamp` range into the metadata filter.
- `/api/chat` derives a coarse range when the question clearly references a
  timeframe (e.g. "today", "yesterday", "last week") via a small keyword heuristic;
  otherwise passes `None`. Conservative — when unsure, no filter (current behavior).
- This is the smallest useful step; richer NL date parsing is explicitly out of
  scope for Tier 1.

### 3.4 Streaming answers with fallback

**Client (`contents/chatbot-float.tsx`):**
- New path in `callChat`: read `serverUrl` and `userId` from `chrome.storage.local`,
  `fetch(`${serverUrl}/api/chat/stream`, { method: "POST", body: <same payload + user_id> })`.
- Parse the SSE body (`ReadableStream` → decode → split on `\n\n` → JSON after
  `data: `). Handle events: `{sources}` (set once), `{delta}` (append to the
  in-progress assistant message), `{done}`, `{error, retry_after}`.
- Render incrementally: append a placeholder assistant message and update its
  `content` as deltas arrive; attach `sources` when received.
- **Fallback:** if the stream fetch fails (non-OK status, network, CORS, or no
  body), fall through to the existing `chrome.runtime.sendMessage({ type: "ASK_CHAT" })`
  one-shot path. The user always gets an answer.

**Server:** `/api/chat/stream` (SSE) and `chat.answer_stream()` already implemented
in a prior pass; no further server work beyond deployment.

**CORS:** server `ALLOWED_ORIGINS=*` permits the content-script fetch; the JSON
POST triggers a preflight that the existing CORS middleware satisfies.

## 4. Data flow summary

1. **Install** → onboarding page → user consents → `trackingEnabled` true.
2. **Browse** → `behavior-monitor` emits → `recordInteraction` gate (tracking on?) →
   dedup → store → batch → `/api/index`.
3. **Inspect/delete** → popup Memory Browser → per-item delete → local remove +
   `/api/forget-item` (reconstruct id → Pinecone delete).
4. **Ask** → chat panel → `/api/chat/stream` (live tokens) or fallback one-shot →
   answer + sources.

## 5. Error handling

- Onboarding page fails to open → tracking stays off (safe default); user can open
  the popup, which detects `!onboarded` and offers to enable.
- `/api/forget-item` unreachable → local delete still applied; surfaced as
  best-effort (no blocking error).
- Streaming failure → silent fallback to one-shot; no user-visible error unless the
  fallback also fails.
- Dedup is purely additive suppression; worst case it skips indexing one repeat —
  never drops a genuinely new interaction.

## 6. Testing

- **Server:** unit tests for `/api/forget-item` (id reconstruction matches index
  id; `None`-format no-ops), `query()` time-range filter shaping, and the existing
  stream endpoint event sequence. Reuse the stub-key conftest.
- **Extension:** manual verification matrix — fresh install shows onboarding and
  tracks nothing until Accept; Memory Browser search/filter/delete (local removed +
  server called); dedup suppresses a re-click within the window; streaming renders
  incrementally and falls back when the stream endpoint is absent.
- Type-check (`tsc --noEmit`) and `plasmo build` must stay clean.

## 7. Out of scope (Tier 1)

- Cross-device sync / encrypted backup.
- On-device / WebGPU local LLM.
- Rich natural-language date parsing beyond the coarse keyword heuristic.
- Canvas-app / PDF / Google Sheets extraction (architecturally impossible DOM-only).
- Proactive summaries, collections, scroll-to-highlight citations (Tier 2+).

## 8. Implementation sequence

1. Onboarding page + consent-first gate + master toggle.
2. Memory Browser UI + `/api/forget-item` (+ `delete_ids`).
3. Client-side dedup + optional retrieval time-range filter.
4. Streaming client with fallback.

Each step is independently shippable and independently verifiable.
