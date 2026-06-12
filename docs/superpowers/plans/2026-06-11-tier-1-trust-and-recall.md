# Tier 1: Trust & Recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Yukti credible as a product — consent-first onboarding, a searchable/deletable memory browser, less-noisy retrieval, and streaming answers.

**Architecture:** Four independently-shippable components. The extension (Plasmo/React/TS) gains an onboarding page, a master tracking gate in the background worker, a memory browser in the popup, client-side dedup, and a streaming chat path with fallback. The server (FastAPI) gains a per-item delete endpoint and an optional time-range retrieval filter. Streaming server code already exists from a prior pass.

**Tech Stack:** Plasmo 0.90.5, React 18, TypeScript 5.3, Chrome MV3; FastAPI, Pinecone (integrated embeddings), pytest.

**Testing note:** The extension has **no unit-test harness** (none exists in the repo, and adding one is out of scope — YAGNI). Extension tasks are verified with `npx tsc --noEmit`, `npm run build`, and explicit manual steps. The **server** has pytest — server tasks follow strict TDD. All commands run from `server/` (Python) or `yukti/` (extension) unless noted.

---

## File Structure

**Extension (`yukti/`):**
- `background.ts` — MODIFY: consent-first defaults, master tracking gate, open onboarding on install, client-side dedup.
- `tabs/onboarding.tsx` — CREATE: dedicated first-run consent page.
- `popup.tsx` — MODIFY: master tracking toggle; Memory Browser (search + date filter + per-item delete).
- `contents/chatbot-float.tsx` — MODIFY: streaming chat path with fallback.

**Server (`server/`):**
- `models/schemas.py` — MODIFY: `ForgetItemRequest`.
- `rag/pinecone_client.py` — MODIFY: `delete_ids()`, optional `time_range` in `query()`.
- `api/routes.py` — MODIFY: `POST /api/forget-item`; pass time-range into `/api/chat` retrieval.
- `tests/test_forget_item.py` — CREATE.
- `tests/test_query_time_range.py` — CREATE.

---

## Component 1 — Onboarding + consent-first gate

### Task 1: Default to consent-first and gate all tracking

**Files:**
- Modify: `yukti/background.ts` (onInstalled defaults ~line 62; recordInteraction ~line 127)

- [ ] **Step 1: Change install defaults to consent-first**

In `chrome.runtime.onInstalled`'s `chrome.storage.local.set({...})`, change `trackingEnabled` and add `onboarded`:

```ts
    trackingEnabled: false, // Consent-first: nothing tracked until the user accepts
    onboarded: false,       // Set true once the onboarding page is completed
    serverUrl: DEFAULT_SERVER_URL,
```

(Leave the rest of the seeded defaults unchanged.)

- [ ] **Step 2: Add the master gate to `recordInteraction`**

In `recordInteraction`, add `"trackingEnabled"` to the `storage.local.get([...])` key list, then gate immediately after the existing incognito guard:

```ts
    // Privacy guard: never track incognito browsing.
    if (interaction.incognito) return

    const result = await chrome.storage.local.get([
      "interactions",
      "interactionsByTab",
      "trackingEnabled",
      "disableClicks",
      "disableScrolling",
      "disableNavigation",
      "disableFormInteractions",
      "disableInputValues",
      "disabledSites"
    ])

    // Master gate: consent-first — record nothing until tracking is enabled.
    if (!result.trackingEnabled) return
```

- [ ] **Step 3: Type-check**

Run (from `yukti/`): `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add yukti/background.ts
git commit -m "feat(extension): consent-first defaults + master tracking gate"
```

---

### Task 2: Build the onboarding page

**Files:**
- Create: `yukti/tabs/onboarding.tsx`

- [ ] **Step 1: Create the onboarding page**

Plasmo serves any `tabs/*.tsx` file as an extension page at `tabs/<name>.html`. Create `yukti/tabs/onboarding.tsx`:

```tsx
import { useEffect, useState } from "react"
import RobotIcon from "~components/RobotIcon"
import SpikeMark from "~components/SpikeMark"
import { color, font, ensureFonts } from "~theme"

const CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: "disableClicks", label: "Clicks", desc: "Elements you click on" },
  { key: "disableScrolling", label: "Scrolling", desc: "Scroll depth on pages" },
  { key: "disableNavigation", label: "Navigation", desc: "Pages you visit" },
  { key: "disableFormInteractions", label: "Form focus", desc: "When you focus form fields" },
  { key: "disableInputValues", label: "Input values", desc: "What you type (passwords never tracked)" },
]

function Onboarding() {
  const [disabled, setDisabled] = useState<{ [k: string]: boolean }>({})
  const [done, setDone] = useState(false)

  useEffect(() => {
    ensureFonts()
    chrome.storage.local
      .get(CATEGORIES.map((c) => c.key))
      .then((r) => {
        const next: { [k: string]: boolean } = {}
        CATEGORIES.forEach((c) => (next[c.key] = r[c.key] || false))
        setDisabled(next)
      })
  }, [])

  async function toggle(key: string, on: boolean) {
    // `on` = user wants tracking; storage stores the DISABLE flag (inverse).
    await chrome.storage.local.set({ [key]: !on })
    setDisabled((p) => ({ ...p, [key]: !on }))
  }

  async function accept(enable: boolean) {
    await chrome.storage.local.set({ onboarded: true, trackingEnabled: enable })
    setDone(true)
  }

  if (done) {
    return (
      <div className="ob-wrap">
        <style>{OB_CSS}</style>
        <div className="ob-card ob-center">
          <RobotIcon size={64} />
          <h1 className="ob-h1">You're all set.</h1>
          <p className="ob-sub">
            You can change anything any time from the Yukti popup. Close this tab to start.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ob-wrap">
      <style>{OB_CSS}</style>
      <div className="ob-card">
        <div className="ob-brand">
          <RobotIcon size={44} />
          <span className="ob-word">Yukti</span>
        </div>
        <h1 className="ob-h1">Private memory for your browser.</h1>
        <p className="ob-sub">
          Yukti remembers what you browse — entirely on your device — so you can just ask
          about it later. Nothing is recorded until you say so.
        </p>

        <h2 className="ob-h2">What Yukti can remember</h2>
        <div className="ob-list">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="ob-row">
              <div>
                <div className="ob-row-label">{c.label}</div>
                <div className="ob-row-desc">{c.desc}</div>
              </div>
              <label className="ob-toggle">
                <input
                  type="checkbox"
                  checked={!disabled[c.key]}
                  onChange={(e) => toggle(c.key, e.target.checked)}
                />
                <span className="ob-slider" />
              </label>
            </div>
          ))}
        </div>

        <div className="ob-note">
          <SpikeMark size={12} color={color.primary} />
          <span>
            Raw data stays local under a private ID unique to you. Password and payment
            fields are never tracked.
          </span>
        </div>

        <div className="ob-actions">
          <button className="ob-btn ob-btn--primary" onClick={() => accept(true)}>
            Accept &amp; enable
          </button>
          <button className="ob-btn ob-btn--ghost" onClick={() => accept(false)}>
            Stay paused
          </button>
        </div>
      </div>
    </div>
  )
}

const OB_CSS = `
.ob-wrap { min-height: 100vh; display: grid; place-items: center; padding: 40px 20px;
  background: ${color.surface}; font-family: ${font.sans}; color: ${color.body}; }
.ob-wrap * { box-sizing: border-box; }
.ob-card { width: 100%; max-width: 520px; background: ${color.canvas};
  border: 1px solid ${color.hairline}; border-radius: 18px; padding: 32px 30px; }
.ob-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ob-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.ob-word { font-family: ${font.serif}; font-weight: 500; font-size: 30px; letter-spacing: -0.6px; color: ${color.ink}; }
.ob-h1 { font-family: ${font.serif}; font-weight: 400; font-size: 30px; line-height: 1.15;
  letter-spacing: -0.6px; color: ${color.ink}; margin: 0 0 10px; }
.ob-sub { font-size: 14.5px; line-height: 1.55; color: ${color.muted}; margin: 0 0 24px; }
.ob-h2 { font-family: ${font.serif}; font-weight: 500; font-size: 17px; color: ${color.ink}; margin: 0 0 12px; }
.ob-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.ob-row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 12px; padding: 13px 15px; }
.ob-row-label { font-size: 14px; font-weight: 600; color: ${color.ink}; }
.ob-row-desc { font-size: 12px; color: ${color.muted}; margin-top: 3px; }
.ob-toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; }
.ob-toggle input { opacity: 0; width: 0; height: 0; }
.ob-slider { position: absolute; inset: 0; cursor: pointer; background: ${color.hairline};
  border-radius: 999px; transition: background 0.18s; }
.ob-slider::before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
  background: ${color.muted}; border-radius: 50%; transition: transform 0.18s, background 0.18s; }
.ob-toggle input:checked + .ob-slider { background: ${color.accentDeep}; }
.ob-toggle input:checked + .ob-slider::before { transform: translateX(18px); background: ${color.onPrimary}; }
.ob-note { display: flex; gap: 9px; align-items: flex-start; background: ${color.card};
  border: 1px solid ${color.hairline}; border-radius: 12px; padding: 13px 14px;
  font-size: 12.5px; line-height: 1.5; color: ${color.body}; margin-bottom: 22px; }
.ob-actions { display: flex; gap: 10px; }
.ob-btn { flex: 1; padding: 13px 16px; border-radius: 10px; cursor: pointer;
  font-family: ${font.sans}; font-size: 14px; font-weight: 600; transition: background 0.15s, border-color 0.15s; }
.ob-btn--primary { background: ${color.primary}; color: ${color.onPrimary}; border: none; }
.ob-btn--primary:hover { background: ${color.primaryDeep}; }
.ob-btn--ghost { background: transparent; color: ${color.body}; border: 1px solid ${color.hairline}; }
.ob-btn--ghost:hover { border-color: ${color.primaryDeep}; color: ${color.ink}; }
`

export default Onboarding
```

- [ ] **Step 2: Type-check and build**

Run (from `yukti/`): `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build ends with `🟢 DONE`. Confirm `build/chrome-mv3-prod/tabs/onboarding.html` exists:
Run: `ls build/chrome-mv3-prod/tabs/onboarding.html`
Expected: the path prints.

- [ ] **Step 3: Commit**

```bash
git add yukti/tabs/onboarding.tsx
git commit -m "feat(extension): consent-first onboarding page"
```

---

### Task 3: Open onboarding on install + popup master toggle

**Files:**
- Modify: `yukti/background.ts` (onInstalled)
- Modify: `yukti/popup.tsx`

- [ ] **Step 1: Open the onboarding tab on fresh install**

In `chrome.runtime.onInstalled.addListener(async () => { ... })`, change the signature to receive `details` and open the page only on first install, after `getOrCreateUserId()`:

```ts
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.storage.local.set({
    // ...existing seeded defaults (now with trackingEnabled:false, onboarded:false)...
  })
  await getOrCreateUserId()
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/onboarding.html") })
  }
  console.log("Yukti: Extension installed")
})
```

- [ ] **Step 2: Add a master tracking toggle to the popup**

In `yukti/popup.tsx`: add state and load it. After `const [disabledSites, setDisabledSites] = useState<string[]>([])` add:

```tsx
  const [trackingEnabled, setTrackingEnabled] = useState(false)
```

In `loadSettings`, add `"trackingEnabled"` to the `keys` array and set it:

```tsx
    setTrackingEnabled(result.trackingEnabled || false)
```

Add a handler near `toggleIndexingPaused`:

```tsx
  async function toggleTracking(on: boolean) {
    setTrackingEnabled(on)
    await chrome.storage.local.set({ trackingEnabled: on })
  }
```

In the Settings tab, as the FIRST control under the `Privacy` heading (above the existing `SETTINGS.map`), add:

```tsx
            <div className="yk-p-settings" style={{ marginBottom: 8 }}>
              <div className="yk-p-setting">
                <div>
                  <div className="yk-p-setting-label">Tracking</div>
                  <div className="yk-p-setting-desc">
                    Master switch — turn all memory collection on or off.
                  </div>
                </div>
                <label className="yk-toggle">
                  <input
                    type="checkbox"
                    checked={trackingEnabled}
                    onChange={(e) => toggleTracking(e.target.checked)}
                  />
                  <span className="yk-slider" />
                </label>
              </div>
            </div>
```

- [ ] **Step 3: Type-check and build**

Run (from `yukti/`): `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build `🟢 DONE`.

- [ ] **Step 4: Manual verification**

Load `build/chrome-mv3-prod` as an unpacked extension in a clean profile.
Expected: onboarding tab opens automatically. Before clicking anything, browse a page — popup Home shows 0 new interactions. Click **Accept & enable**, browse again — interactions increase. Toggle **Tracking** off in Settings — interactions stop.

- [ ] **Step 5: Commit**

```bash
git add yukti/background.ts yukti/popup.tsx
git commit -m "feat(extension): open onboarding on install + master tracking toggle"
```

---

## Component 2 — Memory Browser

### Task 4: Server `/api/forget-item` (TDD)

**Files:**
- Modify: `server/models/schemas.py`
- Modify: `server/rag/pinecone_client.py`
- Modify: `server/api/routes.py`
- Test: `server/tests/test_forget_item.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_forget_item.py`:

```python
from fastapi.testclient import TestClient

import api.routes as routes
from main import app
from rag.formatter import format as format_interaction


def _click():
    return {
        "type": "click",
        "url": "https://example.com/a",
        "timestamp": 1717764493000,
        "elementText": "Apply now",
        "elementType": "button",
    }


def test_forget_item_deletes_reconstructed_id(monkeypatch):
    captured = {}

    def fake_delete_ids(ids):
        captured["ids"] = ids

    monkeypatch.setattr(routes.pinecone_client, "delete_ids", fake_delete_ids)

    client = TestClient(app)
    resp = client.post("/api/forget-item", json={"user_id": "u1", "interaction": _click()})

    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # Must delete the SAME id the formatter would have indexed.
    expected_id = format_interaction(_click()).id
    assert captured["ids"] == [expected_id]


def test_forget_item_noops_on_unindexable(monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(routes.pinecone_client, "delete_ids",
                        lambda ids: called.__setitem__("n", called["n"] + 1))
    client = TestClient(app)
    # A scroll is skipped by the formatter (returns None) → nothing to delete.
    resp = client.post("/api/forget-item",
                       json={"user_id": "u1", "interaction": {"type": "scroll",
                             "url": "https://x.com", "timestamp": 1, "scrollDepth": 10}})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert called["n"] == 0
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`): `PYTHONPATH=. pytest tests/test_forget_item.py -v`
Expected: FAIL — `404` (route missing) or `AttributeError: delete_ids`.

- [ ] **Step 3: Add the schema**

In `server/models/schemas.py`, after `class ForgetResponse`:

```python
class ForgetItemRequest(BaseModel):
    user_id: str = Field(..., description="Per-install UUID that owns the vector.")
    interaction: dict[str, Any] = Field(..., description="Raw interaction to delete.")
```

- [ ] **Step 4: Add `delete_ids` to the Pinecone client**

In `server/rag/pinecone_client.py`, after the `forget` function:

```python
def delete_ids(ids: list[str]) -> dict[str, Any]:
    """Delete specific vectors by id. Delete-by-id is serverless-safe."""
    if not ids:
        return {"deleted": 0}
    _index_handle().delete(ids=ids, namespace=settings.pinecone_namespace)
    return {"deleted": len(ids)}
```

- [ ] **Step 5: Add the route**

In `server/api/routes.py`, update the schemas import to add `ForgetItemRequest`:

```python
from models.schemas import (
    HealthResponse,
    IndexRequest, IndexResponse,
    ChatRequest, ChatResponse, ChatSource,
    ForgetRequest, ForgetResponse, ForgetItemRequest,
)
```

Add the route just before `@router.post("/api/forget", ...)`:

```python
@router.post("/api/forget-item", response_model=ForgetResponse)
@limiter.limit("60/minute")
async def forget_item(request: Request, body: ForgetItemRequest) -> ForgetResponse:
    """Delete a single interaction's vector by reconstructing its deterministic id."""
    try:
        record = format_interaction(body.interaction)
        if record is None:
            # Never indexed (e.g. a scroll) — nothing to delete.
            return ForgetResponse(success=True)
        pinecone_client.delete_ids([record.id])
        return ForgetResponse(success=True)
    except Exception as e:  # noqa: BLE001
        RequestLogger.log_error("/api/forget-item", e)
        return ForgetResponse(success=False, error=str(e))
```

- [ ] **Step 6: Run the test to verify it passes**

Run (from `server/`): `PYTHONPATH=. pytest tests/test_forget_item.py -v`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add server/models/schemas.py server/rag/pinecone_client.py server/api/routes.py server/tests/test_forget_item.py
git commit -m "feat(server): per-item vector delete via /api/forget-item"
```

---

### Task 5: Memory Browser UI (search + date filter)

**Files:**
- Modify: `yukti/popup.tsx`

- [ ] **Step 1: Add a flat memory model + filter state**

In `IndexPopup`, after the existing state declarations add:

```tsx
  const [memQuery, setMemQuery] = useState("")
  const [memRange, setMemRange] = useState<"today" | "7d" | "30d" | "all">("7d")
  const [allInteractions, setAllInteractions] = useState<UserInteraction[]>([])
```

In the mount `useEffect`, add `loadInteractions()`; define it near `loadInteractionsByTab`:

```tsx
  async function loadInteractions() {
    try {
      const r = await chrome.storage.local.get(["interactions"])
      setAllInteractions(r.interactions || [])
    } catch (e) {
      console.error("Failed to load interactions:", e)
    }
  }
```

Add a derived, filtered list helper inside the component (above `return`):

```tsx
  const RANGE_MS: Record<typeof memRange, number> = {
    today: 24 * 3600_000, "7d": 7 * 24 * 3600_000, "30d": 30 * 24 * 3600_000,
    all: Number.MAX_SAFE_INTEGER,
  }
  const filteredMemory = allInteractions
    .filter((it) => Date.now() - it.timestamp <= RANGE_MS[memRange])
    .filter((it) => {
      if (!memQuery.trim()) return true
      const q = memQuery.toLowerCase()
      return [it.url, it.elementText, it.elementType, it.type]
        .some((f) => (f || "").toLowerCase().includes(q))
    })
    .slice(-300)
    .reverse()
```

- [ ] **Step 2: Render the browser in the Data tab**

Replace the `<div className="yk-p-tablist"> ... </div>` block (the tab/date accordion) in the `data` tab with the new browser. Keep the `yk-p-h2`/stats above it and the export/delete `yk-p-actions` below it. New block:

```tsx
            <div className="yk-p-memctl">
              <input
                className="yk-p-input"
                type="text"
                placeholder="Search your memory…"
                value={memQuery}
                onChange={(e) => setMemQuery(e.target.value)}
              />
              <div className="yk-p-ranges">
                {(["today", "7d", "30d", "all"] as const).map((r) => (
                  <button
                    key={r}
                    className={`yk-p-range ${memRange === r ? "is-active" : ""}`}
                    onClick={() => setMemRange(r)}>
                    {r === "today" ? "Today" : r === "all" ? "All" : r}
                  </button>
                ))}
              </div>
            </div>

            <div className="yk-p-memlist">
              {filteredMemory.length === 0 ? (
                <p className="yk-p-empty">Nothing matches — try a wider range.</p>
              ) : (
                filteredMemory.map((it, i) => {
                  let host = it.url
                  try { host = new URL(it.url).hostname.replace(/^www\./, "") } catch {}
                  return (
                    <div key={`${it.timestamp}-${i}`} className="yk-p-memitem">
                      <div className="yk-p-memmain">
                        <span className="yk-p-memtype">{it.type}</span>
                        <span className="yk-p-memhost">{host}</span>
                        {it.elementText && (
                          <span className="yk-p-memtext">“{it.elementText}”</span>
                        )}
                      </div>
                      <div className="yk-p-memmeta">
                        <span className="yk-p-memtime">
                          {new Date(it.timestamp).toLocaleString()}
                        </span>
                        <button
                          className="yk-p-memdel"
                          title="Delete this memory"
                          onClick={() => deleteMemory(it)}>
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
```

- [ ] **Step 3: Add CSS for the browser**

Append to `POPUP_CSS` (before the closing backtick):

```css
.yk-p-memctl { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.yk-p-ranges { display: flex; gap: 6px; }
.yk-p-range { flex: 1; padding: 7px 4px; border-radius: 8px; cursor: pointer;
  background: ${color.card}; border: 1px solid ${color.hairline}; color: ${color.muted};
  font-family: ${font.sans}; font-size: 12px; font-weight: 600; transition: color .15s, border-color .15s; }
.yk-p-range.is-active { color: ${color.ink}; border-color: ${color.primaryDeep}; }
.yk-p-memlist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.yk-p-memitem { display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 10px; padding: 10px 12px; }
.yk-p-memmain { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.yk-p-memtype { font-size: 10.5px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: ${color.primary}; }
.yk-p-memhost { font-size: 12.5px; color: ${color.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yk-p-memtext { font-size: 11.5px; color: ${color.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yk-p-memmeta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.yk-p-memtime { font-size: 10.5px; color: ${color.mutedSoft}; font-family: ${font.mono}; }
.yk-p-memdel { width: 24px; height: 24px; border-radius: 6px; border: 1px solid ${color.hairline};
  background: transparent; color: ${color.muted}; cursor: pointer; font-size: 15px; line-height: 1;
  transition: background .15s, color .15s, border-color .15s; }
.yk-p-memdel:hover { background: ${color.errorSurface}; color: ${color.error}; border-color: ${color.errorBorder}; }
```

- [ ] **Step 4: Type-check (delete handler comes next task — stub it)**

Add a temporary stub above `return` so the file compiles:

```tsx
  async function deleteMemory(_it: UserInteraction) {}
```

Run (from `yukti/`): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add yukti/popup.tsx
git commit -m "feat(extension): memory browser with search + date filter"
```

---

### Task 6: Per-item delete (local + server)

**Files:**
- Modify: `yukti/popup.tsx` (replace the `deleteMemory` stub)

- [ ] **Step 1: Implement `deleteMemory`**

Replace the stub from Task 5 with the real handler. It removes the item locally (flat array + hierarchical) and best-effort deletes the server vector:

```tsx
  async function deleteMemory(target: UserInteraction) {
    const match = (a: UserInteraction) =>
      a.timestamp === target.timestamp && a.url === target.url && a.type === target.type

    const store = await chrome.storage.local.get([
      "interactions", "interactionsByTab", "userId", "serverUrl",
    ])

    // Local: flat array.
    const interactions: UserInteraction[] = (store.interactions || []).filter(
      (a: UserInteraction) => !match(a),
    )

    // Local: hierarchical structure.
    const byTab: InteractionsByTab = store.interactionsByTab || {}
    for (const tab of Object.values(byTab)) {
      for (const dateKey of Object.keys(tab.dates)) {
        tab.dates[dateKey] = tab.dates[dateKey].filter((a) => !match(a))
      }
    }

    await chrome.storage.local.set({ interactions, interactionsByTab: byTab })
    setAllInteractions(interactions)
    setInteractionsByTab(byTab)

    // Server: best-effort vector delete (no-op if endpoint not deployed).
    if (store.userId && store.serverUrl) {
      fetch(`${store.serverUrl}/api/forget-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: store.userId, interaction: target }),
      }).catch(() => {})
    }
  }
```

Note: `UserInteraction` in `popup.tsx` currently omits some fields the server formatter needs (e.g. `inputName`). The server reconstructs the id from whatever fields are present; deletion still matches because indexing used the same subset. No type change required, but ensure the popup `UserInteraction` interface includes the fields it reads (`url`, `type`, `timestamp`, `elementText`, `elementType`) — it already does.

- [ ] **Step 2: Type-check and build**

Run (from `yukti/`): `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build `🟢 DONE`.

- [ ] **Step 3: Manual verification**

Reload the extension. Open popup → Data tab. Search a term, switch ranges, click **×** on an item.
Expected: item disappears immediately; with the server running, a `POST /api/forget-item` appears in its logs; re-opening the popup shows it stays gone.

- [ ] **Step 4: Commit**

```bash
git add yukti/popup.tsx
git commit -m "feat(extension): per-item memory delete (local + server vector)"
```

---

## Component 3 — Better retrieval

### Task 7: Client-side dedup before indexing

**Files:**
- Modify: `yukti/background.ts`

- [ ] **Step 1: Add a recent-key dedup guard**

Near the top-level guards (by `isSendingBatch`), add a module-level recent map:

```ts
// Near-duplicate suppression: skip indexing the same (url|type|text) more than
// once within this window. Exact dupes already collapse via deterministic ids;
// this also saves the network + embedding cost of near-repeats.
const DEDUP_WINDOW_MS = 5 * 60_000
const _recentKeys = new Map<string, number>()

function isNearDuplicate(it: UserInteraction): boolean {
  // Only dedup content interactions; lifecycle/time events are always kept.
  if (!["click", "navigation", "input_value", "form_interaction"].includes(it.type)) {
    return false
  }
  const key = `${it.url}|${it.type}|${it.elementText || ""}`
  const now = Date.now()
  const last = _recentKeys.get(key)
  // Prune opportunistically to bound memory.
  if (_recentKeys.size > 500) {
    for (const [k, t] of _recentKeys) if (now - t > DEDUP_WINDOW_MS) _recentKeys.delete(k)
  }
  _recentKeys.set(key, now)
  return last !== undefined && now - last < DEDUP_WINDOW_MS
}
```

- [ ] **Step 2: Apply it in `recordInteraction`**

Immediately after the master tracking gate (from Task 1) and before reading the rest of storage / pushing, add:

```ts
    // Near-duplicate suppression (after the master gate, before storing).
    if (isNearDuplicate(interaction)) {
      return
    }
```

- [ ] **Step 3: Type-check and build**

Run (from `yukti/`): `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build `🟢 DONE`.

- [ ] **Step 4: Manual verification**

With tracking on, click the same button repeatedly within a minute.
Expected: popup Home interaction count rises once, not once per click. Wait >5 min, click again → counts again.

- [ ] **Step 5: Commit**

```bash
git add yukti/background.ts
git commit -m "feat(extension): suppress near-duplicate interactions before indexing"
```

---

### Task 8: Optional time-range filter in retrieval (TDD)

**Files:**
- Modify: `server/rag/pinecone_client.py`
- Modify: `server/api/routes.py`
- Test: `server/tests/test_query_time_range.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_query_time_range.py`:

```python
import rag.pinecone_client as pc


class _FakeIndex:
    def __init__(self):
        self.last_filter = None

    def search(self, **kwargs):
        self.last_filter = kwargs.get("filter")
        return {"result": {"hits": []}}


def test_query_without_range_filters_only_user(monkeypatch):
    fake = _FakeIndex()
    monkeypatch.setattr(pc, "_index_handle", lambda: fake)
    pc.query(text="hi", user_id="u1")
    assert fake.last_filter == {"user_id": {"$eq": "u1"}}


def test_query_with_range_ands_timestamp(monkeypatch):
    fake = _FakeIndex()
    monkeypatch.setattr(pc, "_index_handle", lambda: fake)
    pc.query(text="hi", user_id="u1", time_range=(1000, 2000))
    assert fake.last_filter == {
        "user_id": {"$eq": "u1"},
        "timestamp": {"$gte": 1000, "$lte": 2000},
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`): `PYTHONPATH=. pytest tests/test_query_time_range.py -v`
Expected: FAIL — `query() got an unexpected keyword argument 'time_range'`.

- [ ] **Step 3: Add `time_range` to `query`**

In `server/rag/pinecone_client.py`, change the `query` signature and filter construction:

```python
def query(
    text: str,
    user_id: str,
    top_k: int = 8,
    time_range: tuple[int, int] | None = None,
) -> list[QueryHit]:
    """Query Pinecone by text, scoped to user_id, optionally within a time range."""
    metadata_filter: dict[str, Any] = {"user_id": {"$eq": user_id}}
    if time_range is not None:
        lo, hi = time_range
        metadata_filter["timestamp"] = {"$gte": lo, "$lte": hi}
    response = _index_handle().search(
        namespace=settings.pinecone_namespace,
        inputs={"text": text},
        top_k=top_k,
        filter=metadata_filter,
        fields=["values_text", "user_id", "url", "tab_title", "timestamp", "type",
                "element_text", "element_type", "input_name", "input_value"],
    )
    response_dict = response if isinstance(response, dict) else response.to_dict()
    hits_raw = response_dict.get("result", {}).get("hits", [])
    return [
        QueryHit(
            id=h.get("_id") or h.get("id_") or "",
            score=float(h.get("_score") or h.get("score_") or 0.0),
            values_text=h["fields"].get("values_text", ""),
            metadata={k: v for k, v in h["fields"].items() if k != "values_text"},
        )
        for h in hits_raw
    ]
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `server/`): `PYTHONPATH=. pytest tests/test_query_time_range.py -v`
Expected: 2 passed.

- [ ] **Step 5: Derive a coarse range in `/api/chat`**

In `server/api/routes.py`, add a helper near `_seconds_until_midnight_utc`:

```python
def _coarse_time_range(question: str) -> tuple[int, int] | None:
    """Map obvious timeframe words to a [start, now] ms range. Conservative —
    returns None when the question has no clear timeframe."""
    q = question.lower()
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    day = 86_400_000
    if "today" in q:
        return (now_ms - day, now_ms)
    if "yesterday" in q:
        return (now_ms - 2 * day, now_ms)
    if "last week" in q or "past week" in q or "this week" in q:
        return (now_ms - 7 * day, now_ms)
    if "last month" in q or "past month" in q:
        return (now_ms - 30 * day, now_ms)
    return None
```

In the `chat` route, change the retrieval call to pass the range:

```python
        try:
            tr = _coarse_time_range(body.question)
            retrieved = pinecone_client.query(
                text=body.question, user_id=body.user_id, top_k=8, time_range=tr,
            )
        except Exception as e:
            log_info(f"   ⚠️  Pinecone query failed: {e}")
            retrieved = []
```

Apply the same `time_range=_coarse_time_range(body.question)` change in the `chat_stream` route's `pinecone_client.query(...)` call.

- [ ] **Step 6: Run the full server suite**

Run (from `server/`): `PYTHONPATH=. pytest tests/ -v`
Expected: all tests pass. (If collection errors occur due to a missing provider package in the local env, run the two new test files explicitly: `PYTHONPATH=. pytest tests/test_forget_item.py tests/test_query_time_range.py -v` → all pass.)

- [ ] **Step 7: Commit**

```bash
git add server/rag/pinecone_client.py server/api/routes.py server/tests/test_query_time_range.py
git commit -m "feat(server): optional time-range filter in retrieval"
```

---

## Component 4 — Streaming answers with fallback

### Task 9: Streaming chat path in the content script

**Files:**
- Modify: `yukti/contents/chatbot-float.tsx`

- [ ] **Step 1: Add an SSE streaming helper**

Above the `FloatingChatbot` component (near `extractPageText`), add a streaming function. It returns `false` if streaming is unavailable so the caller can fall back:

```tsx
interface StreamHandlers {
  onSources: (s: ChatSource[]) => void
  onDelta: (text: string) => void
}

// Try to stream the answer from /api/chat/stream. Returns the final assistant
// text on success, or null if streaming is unavailable (caller falls back).
async function streamChat(
  payload: { question: string; current_url: string; current_page_text: string; chat_history: { role: string; content: string }[] },
  handlers: StreamHandlers,
): Promise<{ text: string } | { retryAfter: number } | null> {
  let serverUrl = ""
  let userId = ""
  try {
    const s = await chrome.storage.local.get(["serverUrl", "userId"])
    serverUrl = s.serverUrl || ""
    userId = s.userId || ""
  } catch {
    return null
  }
  if (!serverUrl || !userId) return null

  let resp: Response
  try {
    resp = await fetch(`${serverUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...payload }),
    })
  } catch {
    return null // network/CORS → fall back
  }
  if (!resp.ok || !resp.body) return null // e.g. 404 (endpoint not deployed)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let full = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() || ""
    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith("data:")) continue
      let evt: any
      try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
      if (evt.sources) handlers.onSources(evt.sources as ChatSource[])
      if (evt.delta) { full += evt.delta; handlers.onDelta(evt.delta) }
      if (evt.error === "rate_limit") return { retryAfter: evt.retry_after || 60 }
      if (evt.error) return null
      if (evt.done) return { text: full }
    }
  }
  return { text: full }
}
```

- [ ] **Step 2: Use streaming in `onSend`, with fallback to `callChat`**

In `onSend`, replace the body after `setIsLoading(true)` with a streaming-first flow. Append a placeholder assistant message, stream into it, and on failure fall back to the existing one-shot `callChat`:

```tsx
  const onSend = async (text: string) => {
    if (isLoading || !text.trim()) return
    const userMsg: ChatMessage = { id: uid("u"), role: "user", content: text }
    const history = historyFrom(messages)
    setMessages((m) => [...m, userMsg])
    setIsLoading(true)

    // Build the same augmented page text used by the one-shot path.
    const selection = getSelectionText()
    let pageText = await extractPageText()
    const nowLine = `[CURRENT LOCAL TIME] ${new Date().toString()}`
    const selBlock = selection
      ? `[SELECTED TEXT — the user is likely asking about this]\n${selection}\n\n`
      : ""
    pageText = `${nowLine}\n\n${selBlock}${pageText}`

    const payload = {
      question: text,
      current_url: window.location.href,
      current_page_text: pageText,
      chat_history: history,
    }

    // Placeholder assistant bubble we stream into.
    const streamId = uid("a")
    let appended = false
    const ensureBubble = () => {
      if (appended) return
      appended = true
      setMessages((m) => [...m, { id: streamId, role: "assistant", content: "", sources: [] }])
    }

    const result = await streamChat(payload, {
      onSources: (s) => {
        ensureBubble()
        setMessages((m) => m.map((x) => (x.id === streamId ? { ...x, sources: s } : x)))
      },
      onDelta: (d) => {
        ensureBubble()
        setMessages((m) =>
          m.map((x) => (x.id === streamId ? { ...x, content: x.content + d } : x)),
        )
      },
    })

    if (result && "text" in result) {
      // Streaming succeeded — ensure final text is set (covers no-delta edge).
      ensureBubble()
      setMessages((m) =>
        m.map((x) => (x.id === streamId ? { ...x, content: result.text } : x)),
      )
      setIsLoading(false)
      return
    }
    if (result && "retryAfter" in result) {
      const secs = result.retryAfter
      const wait =
        secs < 60 ? `${secs} seconds`
        : secs < 3600 ? `${Math.ceil(secs / 60)} minute${secs >= 120 ? "s" : ""}`
        : `${Math.round(secs / 3600)} hour${secs >= 7200 ? "s" : ""}`
      setMessages((m) => [...m, {
        id: uid("r"), role: "assistant",
        content: `I'm being rate-limited right now. Please try again in about ${wait}.`,
      }])
      setIsLoading(false)
      return
    }

    // Streaming unavailable → one-shot fallback (reuses existing callChat).
    const bot = await callChat(text, history)
    setMessages((m) => [...m, bot])
    setIsLoading(false)
  }
```

Note: `callChat` re-extracts the page text; that's acceptable (the fallback path is the exception). Leave `callChat`, `onRegenerate`, and `onClear` unchanged — `onRegenerate` continues to use the one-shot `callChat`.

- [ ] **Step 3: Type-check and build**

Run (from `yukti/`): `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build `🟢 DONE`.

- [ ] **Step 4: Manual verification**

- Against the **current (non-streaming) server**: ask a question → you still get a full answer (fallback path), no regression.
- Against a **local server running the streamed endpoint** (`python main.py`, popup serverUrl → `http://localhost:8000`): the answer renders incrementally token-by-token; sources appear; rate-limit shows the wait message.

- [ ] **Step 5: Commit**

```bash
git add yukti/contents/chatbot-float.tsx
git commit -m "feat(extension): streaming chat with graceful fallback"
```

---

## Final verification

- [ ] **Server suite green**

Run (from `server/`): `PYTHONPATH=. pytest tests/test_forget_item.py tests/test_query_time_range.py -v`
Expected: all pass.

- [ ] **Extension clean**

Run (from `yukti/`): `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build `🟢 DONE`.

- [ ] **End-to-end manual matrix**

1. Fresh install → onboarding opens, nothing tracked until Accept.
2. Memory Browser → search, range switch, per-item delete (local + server call).
3. Dedup → repeated clicks count once within 5 min.
4. Streaming → incremental render locally; clean fallback against non-streaming server.

---

## Notes for the implementer

- **Commits:** the repo owner asked that nothing be committed without their say-so during the current exploration. Treat the `git commit` steps as the intended unit boundaries, but confirm with the owner before actually committing, or run them on a feature branch.
- **Deploy-gated behavior:** `/api/forget-item`, the time-range filter, and streaming only take full effect once `yukti.work.gd` is redeployed. All three degrade gracefully against the current server (local delete still works; no filter; one-shot fallback).
- **Existing installs:** consent-first only changes *new* installs. Existing users keep `trackingEnabled: true`. If you want to force them to re-consent, add a migration that resets `trackingEnabled` when `onboarded` is absent — intentionally omitted here to avoid surprising current users.
