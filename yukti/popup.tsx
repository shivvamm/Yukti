import { useEffect, useState } from "react"
import RobotIcon from "~components/RobotIcon"
import SpikeMark from "~components/SpikeMark"
import { color, font, ensureFonts } from "~theme"

interface UserInteraction {
  type: string
  timestamp: number
  url: string
  elementType?: string
  elementId?: string
  elementClass?: string
  elementText?: string
  timeSpent?: number
  scrollDepth?: number
}

interface TabData {
  tabId: number
  tabTitle: string
  url: string
  dates: { [dateKey: string]: UserInteraction[] }
}

interface InteractionsByTab {
  [tabId: string]: TabData
}

interface Stats {
  totalInteractions: number
  topUrls: { url: string; count: number }[]
  topActions: { type: string; element: string; count: number }[]
  trackingSince: number
}

type Tab = "home" | "settings" | "data" | "about"

const SETTINGS: { key: string; label: string; desc: string }[] = [
  { key: "disableClicks", label: "Clicks", desc: "Elements you click on" },
  { key: "disableScrolling", label: "Scrolling", desc: "Scroll depth on pages" },
  { key: "disableNavigation", label: "Navigation", desc: "Pages you visit" },
  { key: "disableFormInteractions", label: "Form focus", desc: "When you click into form fields" },
  { key: "disableInputValues", label: "Input values", desc: "What you type (passwords never tracked)" },
]

const TABS: { key: Tab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "settings", label: "Settings" },
  { key: "data", label: "Data" },
  { key: "about", label: "About" },
]

function IndexPopup() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [stats, setStats] = useState<Stats | null>(null)
  const [interactionsByTab, setInteractionsByTab] = useState<InteractionsByTab>({})
  const [expandedTabs, setExpandedTabs] = useState<{ [tabId: string]: boolean }>({})
  const [expandedDates, setExpandedDates] = useState<{ [key: string]: boolean }>({})
  const [disabled, setDisabled] = useState<{ [key: string]: boolean }>({})
  const [serverUrl, setServerUrl] = useState("")
  const [indexingPaused, setIndexingPaused] = useState(false)
  const [currentHost, setCurrentHost] = useState("")
  const [disabledSites, setDisabledSites] = useState<string[]>([])
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [memQuery, setMemQuery] = useState("")
  const [memRange, setMemRange] = useState<"today" | "7d" | "30d" | "all">("7d")
  const [allInteractions, setAllInteractions] = useState<UserInteraction[]>([])

  useEffect(() => {
    ensureFonts()
    loadSettings()
    loadStats()
    loadInteractionsByTab()
    loadInteractions()
    loadCurrentHost()
  }, [])

  async function loadInteractions() {
    try {
      const r = await chrome.storage.local.get(["interactions"])
      setAllInteractions(r.interactions || [])
    } catch (e) {
      console.error("Failed to load interactions:", e)
    }
  }

  async function loadCurrentHost() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) setCurrentHost(new URL(tab.url).hostname.replace(/^www\./, ""))
    } catch {
      // chrome:// page or no permission — leave blank.
    }
  }

  async function loadInteractionsByTab() {
    try {
      const result = await chrome.storage.local.get(["interactionsByTab"])
      setInteractionsByTab(result.interactionsByTab || {})
    } catch (error) {
      console.error("Failed to load interactions by tab:", error)
    }
  }

  async function loadSettings() {
    const keys = [...SETTINGS.map((s) => s.key), "serverUrl", "indexingPaused", "disabledSites", "trackingEnabled"]
    const result = await chrome.storage.local.get(keys)
    const next: { [key: string]: boolean } = {}
    SETTINGS.forEach((s) => (next[s.key] = result[s.key] || false))
    setDisabled(next)
    setServerUrl(result.serverUrl || "http://localhost:8000")
    setIndexingPaused(result.indexingPaused || false)
    setDisabledSites(result.disabledSites || [])
    setTrackingEnabled(result.trackingEnabled || false)
  }

  async function toggleIndexingPaused(paused: boolean) {
    setIndexingPaused(paused)
    await chrome.storage.local.set({ indexingPaused: paused })
  }

  async function toggleTracking(on: boolean) {
    setTrackingEnabled(on)
    await chrome.storage.local.set({ trackingEnabled: on })
  }

  // Per-site enable/disable: maintain a list of hostnames Yukti ignores.
  async function toggleSiteDisabled(disable: boolean) {
    if (!currentHost) return
    const next = disable
      ? Array.from(new Set([...disabledSites, currentHost]))
      : disabledSites.filter((h) => h !== currentHost)
    setDisabledSites(next)
    await chrome.storage.local.set({ disabledSites: next })
  }

  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATS" })
      setStats(response)
    } catch (error) {
      console.error("Failed to load stats:", error)
    }
  }

  async function updateSetting(key: string, value: boolean) {
    await chrome.storage.local.set({ [key]: value })
    setDisabled((prev) => ({ ...prev, [key]: value }))
  }

  function toggleTab(tabId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setExpandedTabs((prev) => ({ ...prev, [tabId]: !prev[tabId] }))
  }

  function toggleDate(tabId: string, dateKey: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const key = `${tabId}-${dateKey}`
    setExpandedDates((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  async function exportData() {
    const result = await chrome.storage.local.get(["interactions", "patterns"])
    const dataStr = JSON.stringify(result, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `yukti-data-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function deleteAllData() {
    if (
      !confirm(
        "Delete all collected data, locally and on the server? This cannot be undone.",
      )
    )
      return

    // 1) Best-effort server wipe — remove this user's vectors from Pinecone.
    //    Requires the server's /api/forget endpoint (see server/api/routes.py).
    try {
      const { userId, serverUrl: url } = await chrome.storage.local.get([
        "userId",
        "serverUrl",
      ])
      if (userId && url) {
        await fetch(`${url}/api/forget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        }).catch(() => {})
      }
    } catch {
      // Server unreachable or endpoint not deployed yet — local wipe still proceeds.
    }

    // 2) Local wipe.
    await chrome.storage.local.set({
      interactions: [],
      interactionsByTab: {},
      patterns: { frequentUrls: [], commonActions: [], avgTimeSpent: {}, scrollBehavior: {} },
      batchCounter: 0,
    })
    loadStats()
    loadInteractionsByTab()
  }

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

  return (
    <div className="yk-pop">
      <style>{POPUP_CSS}</style>

      {/* Header */}
      <header className="yk-p-header">
        <div className="yk-p-brand">
          <RobotIcon size={32} />
          <span className="yk-p-wordmark">Yukti</span>
        </div>
        <span className="yk-p-online">
          <span className="yk-p-dot" />
          tracking
        </span>
      </header>

      {/* Tabs */}
      <nav className="yk-p-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`yk-p-tab ${activeTab === t.key ? "is-active" : ""}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="yk-p-content">
        {activeTab === "home" && (
          <div className="yk-p-fade">
            <p className="yk-p-lede">
              Your browsing, <em>remembered</em>. Yukti quietly indexes what you do so you can
              ask about it later.
            </p>
            <div className="yk-p-stats">
              <div className="yk-p-stat">
                <div className="yk-p-stat-num">{stats?.totalInteractions ?? 0}</div>
                <div className="yk-p-stat-label">Interactions</div>
              </div>
              <div className="yk-p-stat">
                <div className="yk-p-stat-num">{stats?.topUrls.length ?? 0}</div>
                <div className="yk-p-stat-label">Sites tracked</div>
              </div>
            </div>
            <div className="yk-p-hint">
              <SpikeMark size={12} color={color.primary} />
              <span>Click the floating robot on any page to start a conversation.</span>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="yk-p-fade">
            <h2 className="yk-p-h2">Privacy</h2>
            <p className="yk-p-sub">Turn off anything you'd rather Yukti not track.</p>
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
            <div className="yk-p-settings">
              {SETTINGS.map((s) => (
                <div key={s.key} className="yk-p-setting">
                  <div>
                    <div className="yk-p-setting-label">{s.label}</div>
                    <div className="yk-p-setting-desc">{s.desc}</div>
                  </div>
                  <label className="yk-toggle">
                    <input
                      type="checkbox"
                      checked={!disabled[s.key]}
                      onChange={(e) => updateSetting(s.key, !e.target.checked)}
                    />
                    <span className="yk-slider" />
                  </label>
                </div>
              ))}
            </div>

            <h2 className="yk-p-h2" style={{ marginTop: 18 }}>Indexing</h2>
            <p className="yk-p-sub">Pause sending, or silence Yukti on specific sites.</p>
            <div className="yk-p-settings">
              <div className="yk-p-setting">
                <div>
                  <div className="yk-p-setting-label">Pause indexing</div>
                  <div className="yk-p-setting-desc">
                    Keep browsing private — stop sending interactions to the server.
                  </div>
                </div>
                <label className="yk-toggle">
                  <input
                    type="checkbox"
                    checked={indexingPaused}
                    onChange={(e) => toggleIndexingPaused(e.target.checked)}
                  />
                  <span className="yk-slider" />
                </label>
              </div>
              <div className="yk-p-setting">
                <div>
                  <div className="yk-p-setting-label">Disable on this site</div>
                  <div className="yk-p-setting-desc">
                    {currentHost
                      ? `Turn Yukti off entirely on ${currentHost}.`
                      : "Open a normal web page to toggle this."}
                  </div>
                </div>
                <label className="yk-toggle">
                  <input
                    type="checkbox"
                    disabled={!currentHost}
                    checked={!!currentHost && disabledSites.includes(currentHost)}
                    onChange={(e) => toggleSiteDisabled(e.target.checked)}
                  />
                  <span className="yk-slider" />
                </label>
              </div>
            </div>

            <h2 className="yk-p-h2" style={{ marginTop: 18 }}>Server</h2>
            <p className="yk-p-sub">The URL of your Yukti backend server.</p>
            <input
              className="yk-p-input"
              type="url"
              value={serverUrl}
              placeholder="http://localhost:8000"
              onChange={(e) => setServerUrl(e.target.value)}
              onBlur={() => {
                const url = serverUrl.replace(/\/+$/, "")
                setServerUrl(url)
                chrome.storage.local.set({ serverUrl: url })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              }}
            />
          </div>
        )}

        {activeTab === "data" && (
          <div className="yk-p-fade">
            <h2 className="yk-p-h2">Your data</h2>
            {stats && (
              <p className="yk-p-sub">
                {stats.totalInteractions.toLocaleString()} interactions tracked since{" "}
                {new Date(stats.trackingSince).toLocaleDateString()}.
              </p>
            )}

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

            <div className="yk-p-actions">
              <button onClick={exportData} className="yk-p-btn yk-p-btn--primary">
                Export JSON
              </button>
              <button onClick={deleteAllData} className="yk-p-btn yk-p-btn--danger">
                Delete all
              </button>
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="yk-p-fade">
            <h2 className="yk-p-h2">About</h2>
            <p className="yk-p-body">
              Yukti is a privacy-minded browser assistant. It indexes your interactions into your
              own vector store, then answers questions about the page you're on and your browsing
              history.
            </p>
            <h3 className="yk-p-h3">How your data flows</h3>
            <ul className="yk-p-ul">
              <li>Interactions are stored locally and indexed under a private ID unique to you.</li>
              <li>Retrieval is scoped to your ID — no one else's history is ever searched.</li>
              <li>Password and payment fields are never tracked.</li>
              <li>Export or wipe everything from the Data tab at any time.</li>
            </ul>
            <div className="yk-p-version">
              <SpikeMark size={11} color={color.accent} />
              <span>Yukti v2.0 · RAG chat</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const POPUP_CSS = `
.yk-pop {
  width: 380px;
  min-height: 360px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  background: ${color.canvas};
  color: ${color.body};
  font-family: ${font.sans};
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
.yk-pop * { box-sizing: border-box; }

/* Header */
.yk-p-header {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid ${color.hairlineSoft};
}
.yk-p-header::after {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 90px; pointer-events: none;
  background: radial-gradient(110% 80% at 14% 0%, rgba(34,211,238,0.10), transparent 70%);
}
.yk-p-brand { display: flex; align-items: center; gap: 11px; position: relative; }
.yk-p-wordmark {
  font-family: ${font.serif}; font-weight: 500; font-size: 24px;
  letter-spacing: -0.5px; color: ${color.ink}; line-height: 1;
}
.yk-p-online {
  display: flex; align-items: center; gap: 6px; position: relative;
  font-size: 11px; font-weight: 500; letter-spacing: 0.3px; color: ${color.muted};
}
.yk-p-dot { width: 7px; height: 7px; border-radius: 50%; background: ${color.accent}; box-shadow: 0 0 0 3px rgba(52,211,153,0.14); }

/* Tabs */
.yk-p-tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid ${color.hairlineSoft}; }
.yk-p-tab {
  position: relative;
  flex: 1; padding: 9px 6px 11px; border: none; background: transparent; cursor: pointer;
  font-family: ${font.sans}; font-size: 13px; font-weight: 500; color: ${color.muted};
  transition: color 0.15s;
}
.yk-p-tab:hover { color: ${color.bodyStrong}; }
.yk-p-tab.is-active { color: ${color.ink}; }
.yk-p-tab.is-active::after {
  content: ""; position: absolute; left: 14%; right: 14%; bottom: -1px; height: 2px;
  background: ${color.primary}; border-radius: 2px;
}

/* Content */
.yk-p-content { flex: 1; overflow-y: auto; padding: 20px 18px; background: ${color.surface}; }
.yk-p-content::-webkit-scrollbar { width: 10px; }
.yk-p-content::-webkit-scrollbar-thumb { background: ${color.hairline}; border-radius: 99px; border: 3px solid ${color.surface}; }
.yk-p-fade { animation: yk-p-fade 0.25s ease; }
@keyframes yk-p-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.yk-p-h2 {
  font-family: ${font.serif}; font-weight: 400; font-size: 24px; letter-spacing: -0.5px;
  color: ${color.ink}; margin: 0 0 4px;
}
.yk-p-h3 {
  font-family: ${font.serif}; font-weight: 500; font-size: 16px; letter-spacing: -0.2px;
  color: ${color.ink}; margin: 20px 0 8px;
}
.yk-p-sub { font-size: 13px; color: ${color.muted}; margin: 0 0 18px; line-height: 1.5; }
.yk-p-body { font-size: 13.5px; color: ${color.body}; line-height: 1.6; margin: 0 0 4px; }
.yk-p-lede {
  font-family: ${font.serif}; font-weight: 400; font-size: 19px; line-height: 1.4;
  letter-spacing: -0.3px; color: ${color.bodyStrong}; margin: 0 0 22px;
}
.yk-p-lede em { color: ${color.primary}; font-style: italic; }

/* Home stats */
.yk-p-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
.yk-p-stat {
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 12px;
  padding: 18px 16px; text-align: left;
}
.yk-p-stat-num {
  font-family: ${font.serif}; font-weight: 500; font-size: 38px; line-height: 1;
  letter-spacing: -1px; color: ${color.ink};
}
.yk-p-stat-label {
  font-size: 11px; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase;
  color: ${color.muted}; margin-top: 8px;
}
.yk-p-hint {
  display: flex; gap: 9px; align-items: flex-start;
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 12px;
  padding: 13px 14px; font-size: 12.5px; line-height: 1.5; color: ${color.body};
}

/* Settings */
.yk-p-settings { display: flex; flex-direction: column; gap: 8px; }
.yk-p-setting {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 12px;
  padding: 13px 15px;
}
.yk-p-setting-label { font-size: 13.5px; font-weight: 600; color: ${color.ink}; }
.yk-p-setting-desc { font-size: 11.5px; color: ${color.muted}; margin-top: 3px; }

/* Toggle */
.yk-toggle { position: relative; display: inline-block; width: 42px; height: 24px; flex-shrink: 0; }
.yk-toggle input { opacity: 0; width: 0; height: 0; }
.yk-slider {
  position: absolute; inset: 0; cursor: pointer;
  background: ${color.hairline}; border-radius: 999px; transition: background 0.18s;
}
.yk-slider::before {
  content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
  background: ${color.muted}; border-radius: 50%; transition: transform 0.18s, background 0.18s;
}
.yk-toggle input:checked + .yk-slider { background: ${color.accentDeep}; }
.yk-toggle input:checked + .yk-slider::before { transform: translateX(18px); background: ${color.onPrimary}; }

/* Server URL input */
.yk-p-input {
  width: 100%; padding: 10px 12px; margin-top: 6px;
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 10px;
  color: ${color.ink}; font-family: ${font.mono}; font-size: 12.5px;
  outline: none; transition: border-color 0.15s;
}
.yk-p-input:focus { border-color: ${color.accent}; }
.yk-p-input::placeholder { color: ${color.muted}; }

/* Data accordion */
.yk-p-tablist { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
.yk-p-empty { text-align: center; color: ${color.muted}; font-size: 12.5px; padding: 28px 12px; font-style: italic; }
.yk-p-card { background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 12px; overflow: hidden; }
.yk-p-card-head, .yk-p-date-head {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 12px 14px; background: transparent; border: none; cursor: pointer; text-align: left;
  font-family: ${font.sans};
}
.yk-p-card-head:hover, .yk-p-date-head:hover { background: ${color.elevated}; }
.yk-p-caret { color: ${color.primary}; font-size: 11px; width: 12px; flex-shrink: 0; }
.yk-p-card-info { flex: 1; min-width: 0; }
.yk-p-card-title { font-size: 13px; font-weight: 600; color: ${color.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yk-p-card-url { font-size: 11px; color: ${color.muted}; margin-top: 2px; }
.yk-p-dates { padding: 6px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
.yk-p-date { background: ${color.canvas}; border: 1px solid ${color.hairlineSoft}; border-radius: 8px; overflow: hidden; }
.yk-p-date-head { padding: 9px 12px; }
.yk-p-date-text { flex: 1; font-size: 12px; font-weight: 500; color: ${color.body}; }
.yk-p-count {
  font-size: 11px; font-weight: 600; color: ${color.accent};
  background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.25);
  border-radius: 999px; padding: 1px 9px;
}
.yk-p-events { padding: 4px 12px 10px; display: flex; flex-direction: column; gap: 2px; }
.yk-p-event { display: flex; align-items: center; gap: 9px; padding: 4px 0; font-size: 11px; }
.yk-p-event-time { color: ${color.mutedSoft}; font-family: ${font.mono}; font-size: 10.5px; min-width: 52px; }
.yk-p-event-type { color: ${color.primary}; font-weight: 600; font-size: 10.5px; }
.yk-p-event-detail { color: ${color.mutedSoft}; font-size: 10.5px; }

/* Buttons */
.yk-p-actions { display: flex; gap: 10px; }
.yk-p-btn {
  flex: 1; padding: 11px 16px; border-radius: 8px; cursor: pointer;
  font-family: ${font.sans}; font-size: 13px; font-weight: 600; transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.yk-p-btn--primary { background: ${color.primary}; color: ${color.onPrimary}; border: none; }
.yk-p-btn--primary:hover { background: ${color.primaryDeep}; }
.yk-p-btn--danger { background: transparent; color: ${color.error}; border: 1px solid ${color.errorBorder}; }
.yk-p-btn--danger:hover { background: ${color.errorSurface}; }

/* About */
.yk-p-ul { margin: 0; padding-left: 18px; font-size: 13px; color: ${color.body}; line-height: 1.7; }
.yk-p-ul li { margin: 5px 0; }
.yk-p-ul li::marker { color: ${color.primaryDeep}; }
.yk-p-version {
  display: flex; align-items: center; gap: 8px; margin-top: 22px; padding-top: 16px;
  border-top: 1px solid ${color.hairlineSoft}; font-size: 12px; color: ${color.muted};
}

/* Memory browser */
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
`

export default IndexPopup
