import { useEffect, useState } from "react"

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
  dates: {
    [dateKey: string]: UserInteraction[]
  }
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

function IndexPopup() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [interactionsByTab, setInteractionsByTab] = useState<InteractionsByTab>({})
  const [expandedTabs, setExpandedTabs] = useState<{ [tabId: string]: boolean }>({})
  const [expandedDates, setExpandedDates] = useState<{ [key: string]: boolean }>({})

  // Settings (opt-out: true = don't track)
  const [disableClicks, setDisableClicks] = useState(false)
  const [disableScrolling, setDisableScrolling] = useState(false)
  const [disableNavigation, setDisableNavigation] = useState(false)
  const [disableFormInteractions, setDisableFormInteractions] = useState(false)
  const [disableInputValues, setDisableInputValues] = useState(false)

  // Add CSS for toggle switches
  const toggleCSS = `
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #cbd5e1;
      transition: 0.4s;
      border-radius: 24px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: #4f46e5;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(20px);
    }
  `

  // Load initial state
  useEffect(() => {
    loadSettings()
    loadSuggestions()
    loadStats()
    loadInteractionsByTab()
  }, [])

  async function loadInteractionsByTab() {
    try {
      const result = await chrome.storage.local.get(["interactionsByTab"])
      setInteractionsByTab(result.interactionsByTab || {})
    } catch (error) {
      console.error("Failed to load interactions by tab:", error)
    }
  }

  function toggleTab(tabId: string) {
    setExpandedTabs((prev) => ({ ...prev, [tabId]: !prev[tabId] }))
  }

  function toggleDate(tabId: string, dateKey: string) {
    const key = `${tabId}-${dateKey}`
    setExpandedDates((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString()
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get([
      "disableClicks",
      "disableScrolling",
      "disableNavigation",
      "disableFormInteractions",
      "disableInputValues"
    ])

    setDisableClicks(result.disableClicks || false)
    setDisableScrolling(result.disableScrolling || false)
    setDisableNavigation(result.disableNavigation || false)
    setDisableFormInteractions(result.disableFormInteractions || false)
    setDisableInputValues(result.disableInputValues || false)
  }

  async function loadSuggestions() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const response = await chrome.runtime.sendMessage({
        type: "GET_SUGGESTIONS",
        url: tab.url
      })
      setSuggestions(response || [])
    } catch (error) {
      console.error("Failed to load suggestions:", error)
    }
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

    switch (key) {
      case "disableClicks":
        setDisableClicks(value)
        break
      case "disableScrolling":
        setDisableScrolling(value)
        break
      case "disableNavigation":
        setDisableNavigation(value)
        break
      case "disableFormInteractions":
        setDisableFormInteractions(value)
        break
      case "disableInputValues":
        setDisableInputValues(value)
        break
    }
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
    if (confirm("Are you sure you want to delete all collected data? This cannot be undone.")) {
      await chrome.storage.local.set({
        interactions: [],
        patterns: {
          frequentUrls: [],
          commonActions: [],
          avgTimeSpent: {},
          scrollBehavior: {}
        }
      })
      loadStats()
      alert("All data deleted successfully")
    }
  }

  return (
    <div style={styles.container}>
      <style>{toggleCSS}</style>
      <div style={styles.header}>
        <h1 style={styles.mainTitle}>Yukti</h1>
        <div style={styles.statusBadge}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: "#10b981"
            }}
          />
          Active
        </div>
      </div>

      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab("home")}
          style={activeTab === "home" ? styles.tabActive : styles.tab}>
          Home
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          style={activeTab === "settings" ? styles.tabActive : styles.tab}>
          Settings
        </button>
        <button
          onClick={() => setActiveTab("data")}
          style={activeTab === "data" ? styles.tabActive : styles.tab}>
          Data
        </button>
        <button
          onClick={() => setActiveTab("about")}
          style={activeTab === "about" ? styles.tabActive : styles.tab}>
          About
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === "home" && (
          <div>
            <h2 style={styles.sectionTitle}>Suggestions</h2>
            <div style={styles.suggestions}>
              {suggestions.map((suggestion, index) => (
                <div key={index} style={styles.suggestionItem}>
                  <span style={styles.suggestionIcon}>💡</span>
                  <p style={styles.suggestionText}>{suggestion}</p>
                </div>
              ))}
            </div>

            {stats && (
              <div style={styles.statsSection}>
                <h3 style={styles.subtitle}>Quick Stats</h3>
                <div style={styles.statGrid}>
                  <div style={styles.statItem}>
                    <div style={styles.statValue}>{stats.totalInteractions}</div>
                    <div style={styles.statLabel}>Interactions</div>
                  </div>
                  <div style={styles.statItem}>
                    <div style={styles.statValue}>{stats.topUrls.length}</div>
                    <div style={styles.statLabel}>Sites Tracked</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <h2 style={styles.sectionTitle}>Privacy Settings</h2>

            <h3 style={styles.subtitle}>What NOT to Track</h3>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Disable Clicks</div>
                    <div style={styles.settingDesc}>Stop tracking elements you click</div>
                  </div>
                  <label className="toggle-switch" style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={disableClicks}
                      onChange={(e) => updateSetting("disableClicks", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Disable Scrolling</div>
                    <div style={styles.settingDesc}>Stop tracking scroll depth on pages</div>
                  </div>
                  <label className="toggle-switch" style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={disableScrolling}
                      onChange={(e) => updateSetting("disableScrolling", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Disable Navigation</div>
                    <div style={styles.settingDesc}>Stop tracking pages you visit</div>
                  </div>
                  <label className="toggle-switch" style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={disableNavigation}
                      onChange={(e) => updateSetting("disableNavigation", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Disable Form Focus</div>
                    <div style={styles.settingDesc}>
                      Stop tracking when you click into form fields
                    </div>
                  </div>
                  <label className="toggle-switch" style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={disableFormInteractions}
                      onChange={(e) => updateSetting("disableFormInteractions", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Disable Input Values</div>
                    <div style={styles.settingDesc}>
                      Stop tracking what you type (passwords NEVER tracked)
                    </div>
                  </div>
                  <label className="toggle-switch" style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={disableInputValues}
                      onChange={(e) => updateSetting("disableInputValues", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
          </div>
        )}

        {activeTab === "data" && (
          <div>
            <h2 style={styles.sectionTitle}>Your Data</h2>

            {stats && (
              <div style={styles.dataSection}>
                <p style={styles.text}>
                  <strong>Total Interactions:</strong> {stats.totalInteractions}
                </p>
                <p style={styles.text}>
                  <strong>Tracking Since:</strong>{" "}
                  {new Date(stats.trackingSince).toLocaleDateString()}
                </p>
              </div>
            )}

            <h3 style={styles.subtitle}>Interactions by Tab & Date</h3>
            <div style={styles.tabList}>
              {Object.keys(interactionsByTab).length === 0 ? (
                <p style={styles.emptyMessage}>No tab data yet. Start browsing to see your interactions!</p>
              ) : (
                Object.entries(interactionsByTab).map(([tabId, tabData]) => (
                  <div key={tabId} style={styles.tabCard}>
                    <div style={styles.tabHeader} onClick={() => toggleTab(tabId)}>
                      <span style={styles.expandIcon}>{expandedTabs[tabId] ? "▼" : "▶"}</span>
                      <div style={styles.tabInfo}>
                        <div style={styles.tabTitle}>{tabData.tabTitle}</div>
                        <div style={styles.tabUrl}>{new URL(tabData.url).hostname}</div>
                      </div>
                    </div>

                    {expandedTabs[tabId] && (
                      <div style={styles.dateList}>
                        {Object.entries(tabData.dates).map(([dateKey, interactions]) => (
                          <div key={dateKey} style={styles.dateCard}>
                            <div
                              style={styles.dateHeader}
                              onClick={() => toggleDate(tabId, dateKey)}>
                              <span style={styles.expandIcon}>
                                {expandedDates[`${tabId}-${dateKey}`] ? "▼" : "▶"}
                              </span>
                              <div style={styles.dateInfo}>
                                <span style={styles.dateText}>{dateKey}</span>
                                <span style={styles.countBadge}>
                                  {interactions.length} actions
                                </span>
                              </div>
                            </div>

                            {expandedDates[`${tabId}-${dateKey}`] && (
                              <div style={styles.interactionList}>
                                {interactions.map((interaction, index) => (
                                  <div key={index} style={styles.interactionItem}>
                                    <span style={styles.interactionTime}>
                                      {formatTime(interaction.timestamp)}
                                    </span>
                                    <span style={styles.interactionType}>{interaction.type}</span>
                                    {interaction.elementType && (
                                      <span style={styles.interactionDetail}>
                                        {interaction.elementType}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={styles.buttonGroup}>
              <button onClick={exportData} style={styles.primaryButton}>
                Export Data (JSON)
              </button>
              <button onClick={deleteAllData} style={styles.dangerButton}>
                Delete All Data
              </button>
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div>
            <h2 style={styles.sectionTitle}>About Yukti</h2>
            <p style={styles.text}>
              Yukti is an AI-powered browser assistant that learns from your behavior to provide
              intelligent suggestions.
            </p>

            <h3 style={styles.subtitle}>Privacy First</h3>
            <ul style={styles.list}>
              <li>All data is stored locally on your device</li>
              <li>No data is sent to external servers</li>
              <li>Sensitive sites (banking, healthcare) are automatically blocked</li>
              <li>Password and payment fields are never tracked</li>
              <li>You have complete control over your data</li>
            </ul>

            <h3 style={styles.subtitle}>Version</h3>
            <p style={styles.text}>0.0.1</p>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: 320,
    minHeight: 350,
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f9fafb",
    color: "#111827"
  },
  header: {
    backgroundColor: "#4f46e5",
    color: "white",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  mainTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: "bold"
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 12
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%"
  },
  tabs: {
    display: "flex",
    backgroundColor: "white",
    borderBottom: "1px solid #e5e7eb"
  },
  tab: {
    flex: 1,
    padding: "10px 12px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: 13,
    color: "#6b7280",
    borderBottom: "2px solid transparent",
    transition: "all 0.2s"
  },
  tabActive: {
    flex: 1,
    padding: "10px 12px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: 13,
    color: "#4f46e5",
    borderBottom: "2px solid #4f46e5",
    fontWeight: 600
  },
  content: {
    padding: 12,
    maxHeight: 280,
    overflowY: "auto"
  },
  consent: {
    padding: 30,
    textAlign: "center"
  },
  title: {
    margin: "0 0 16px 0",
    fontSize: 24,
    color: "#111827"
  },
  text: {
    margin: "0 0 16px 0",
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.6
  },
  consentSection: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: "left"
  },
  subtitle: {
    margin: "0 0 12px 0",
    fontSize: 16,
    fontWeight: 600,
    color: "#111827"
  },
  optOutDesc: {
    margin: "0 0 16px 0",
    fontSize: 13,
    color: "#ef4444",
    lineHeight: 1.5,
    fontWeight: 500
  },
  list: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.8
  },
  buttonGroup: {
    display: "flex",
    gap: 12,
    marginTop: 20
  },
  primaryButton: {
    flex: 1,
    padding: "10px 20px",
    backgroundColor: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "background-color 0.2s"
  },
  secondaryButton: {
    flex: 1,
    padding: "10px 20px",
    backgroundColor: "#e5e7eb",
    color: "#111827",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "background-color 0.2s"
  },
  dangerButton: {
    flex: 1,
    padding: "10px 20px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "background-color 0.2s"
  },
  sectionTitle: {
    margin: "0 0 12px 0",
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827"
  },
  warning: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fcd34d",
    padding: 16,
    borderRadius: 8,
    color: "#92400e"
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  suggestionItem: {
    display: "flex",
    gap: 12,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    border: "1px solid #e5e7eb"
  },
  suggestionIcon: {
    fontSize: 20
  },
  suggestionText: {
    margin: 0,
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.6
  },
  statsSection: {
    marginTop: 24,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    border: "1px solid #e5e7eb"
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16
  },
  statItem: {
    textAlign: "center"
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4f46e5"
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4
  },
  setting: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderBottom: "1px solid #e5e7eb"
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 4
  },
  settingDesc: {
    fontSize: 12,
    color: "#6b7280"
  },
  switch: {
    position: "relative",
    display: "inline-block",
    width: 44,
    height: 24
  },
  slider: {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#cbd5e1",
    transition: "0.4s",
    borderRadius: 24
  },
  dataSection: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    border: "1px solid #e5e7eb"
  },
  topSites: {
    marginTop: 16
  },
  urlItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 0",
    fontSize: 14,
    color: "#374151"
  },
  urlRank: {
    fontWeight: "bold",
    marginRight: 8,
    color: "#4f46e5"
  },
  urlText: {
    flex: 1
  },
  tabList: {
    marginBottom: 16
  },
  tabCard: {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden"
  },
  tabHeader: {
    display: "flex",
    alignItems: "center",
    padding: 12,
    cursor: "pointer",
    gap: 8,
    backgroundColor: "#f9fafb"
  },
  tabInfo: {
    flex: 1
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 4
  },
  tabUrl: {
    fontSize: 12,
    color: "#6b7280"
  },
  expandIcon: {
    fontSize: 12,
    color: "#6b7280",
    width: 16
  },
  dateList: {
    padding: 8
  },
  dateCard: {
    backgroundColor: "#fefefe",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden"
  },
  dateHeader: {
    display: "flex",
    alignItems: "center",
    padding: 10,
    cursor: "pointer",
    gap: 8,
    backgroundColor: "#f9fafb"
  },
  dateInfo: {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  dateText: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151"
  },
  countBadge: {
    fontSize: 11,
    padding: "2px 8px",
    backgroundColor: "#4f46e5",
    color: "white",
    borderRadius: 12,
    fontWeight: 600
  },
  interactionList: {
    padding: 8
  },
  interactionItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 6,
    fontSize: 12,
    borderBottom: "1px solid #f3f4f6"
  },
  interactionTime: {
    color: "#6b7280",
    fontWeight: 500,
    minWidth: 70
  },
  interactionType: {
    color: "#4f46e5",
    fontWeight: 600,
    textTransform: "capitalize"
  },
  interactionDetail: {
    color: "#9ca3af",
    fontSize: 11
  },
  emptyMessage: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    padding: 20
  }
}

export default IndexPopup
