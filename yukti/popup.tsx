import { useEffect, useState } from "react"
import RobotIcon from "~components/RobotIcon"

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

  // Add CSS for toggle switches and scrollbar
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
      background-color: #334155;
      transition: 0.15s;
      border-radius: 0;
      border: 2px solid #1e293b;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 2px;
      bottom: 2px;
      background-color: #64748b;
      transition: 0.15s;
      border-radius: 0;
      border: 2px solid #475569;
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: #10b981;
      border: 2px solid #059669;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(20px);
      background-color: #0f172a;
      border: 2px solid #10b981;
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #1e293b;
      border-left: 2px solid #334155;
    }

    ::-webkit-scrollbar-thumb {
      background: #06b6d4;
      border: 2px solid #0891b2;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #0891b2;
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

  function toggleTab(tabId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    setExpandedTabs((prev) => ({ ...prev, [tabId]: !prev[tabId] }))
  }

  function toggleDate(tabId: string, dateKey: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    e?.preventDefault()
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
        <div style={styles.headerLeft}>
          <RobotIcon size={36} />
          <h1 style={styles.mainTitle}>Yukti</h1>
        </div>
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
                Object.entries(interactionsByTab).map(([tabId, tabData]) => {
                  let hostname = tabData.url
                  try {
                    hostname = new URL(tabData.url).hostname
                  } catch (e) {
                    // If URL parsing fails, use the raw URL
                  }

                  return (
                    <div key={tabId} style={styles.tabCard}>
                      <div style={styles.tabHeader} onClick={(e) => toggleTab(tabId, e)}>
                        <span style={styles.expandIcon}>{expandedTabs[tabId] ? "▼" : "▶"}</span>
                        <div style={styles.tabInfo}>
                          <div style={styles.tabTitle}>{tabData.tabTitle}</div>
                          <div style={styles.tabUrl}>{hostname}</div>
                        </div>
                      </div>

                    {expandedTabs[tabId] && (
                      <div style={styles.dateList}>
                        {Object.entries(tabData.dates).map(([dateKey, interactions]) => (
                          <div key={dateKey} style={styles.dateCard}>
                            <div
                              style={styles.dateHeader}
                              onClick={(e) => toggleDate(tabId, dateKey, e)}>
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
                  )
                })
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
    width: 360,
    minHeight: 350,
    maxHeight: 600,
    fontFamily: "'Courier New', 'Courier', monospace",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    overflow: "hidden"
  },
  header: {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "3px solid #06b6d4",
    boxShadow: "0 2px 0 #334155"
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12
  },
  mainTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: "2px",
    textTransform: "uppercase"
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#334155",
    padding: "6px 12px",
    borderRadius: 0,
    fontSize: 11,
    fontWeight: "bold",
    border: "2px solid #10b981",
    letterSpacing: "1px"
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 0
  },
  tabs: {
    display: "flex",
    backgroundColor: "#1e293b",
    borderBottom: "3px solid #334155"
  },
  tab: {
    flex: 1,
    padding: "12px",
    border: "none",
    backgroundColor: "#1e293b",
    cursor: "pointer",
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.15s",
    borderRight: "2px solid #334155"
  },
  tabActive: {
    flex: 1,
    padding: "12px",
    border: "none",
    backgroundColor: "#334155",
    cursor: "pointer",
    fontSize: 12,
    color: "#06b6d4",
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderRight: "2px solid #334155",
    boxShadow: "inset 0 -3px 0 #06b6d4"
  },
  content: {
    padding: 16,
    maxHeight: 400,
    overflowY: "auto",
    backgroundColor: "#0f172a"
  },
  consent: {
    padding: 30,
    textAlign: "center"
  },
  title: {
    margin: "0 0 16px 0",
    fontSize: 24,
    color: "#e2e8f0"
  },
  text: {
    margin: "0 0 16px 0",
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.7
  },
  consentSection: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 0,
    marginBottom: 16,
    textAlign: "left",
    border: "2px solid #334155"
  },
  subtitle: {
    margin: "0 0 14px 0",
    fontSize: 14,
    fontWeight: "bold",
    color: "#06b6d4",
    textTransform: "uppercase",
    letterSpacing: "1.5px"
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
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.8
  },
  buttonGroup: {
    display: "flex",
    gap: 12,
    marginTop: 20
  },
  primaryButton: {
    flex: 1,
    padding: "12px 20px",
    backgroundColor: "#06b6d4",
    color: "#0f172a",
    border: "3px solid #0891b2",
    borderRadius: 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.15s",
    boxShadow: "0 3px 0 #0891b2"
  },
  secondaryButton: {
    flex: 1,
    padding: "12px 20px",
    backgroundColor: "#334155",
    color: "#e2e8f0",
    border: "3px solid #1e293b",
    borderRadius: 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.15s",
    boxShadow: "0 3px 0 #1e293b"
  },
  dangerButton: {
    flex: 1,
    padding: "12px 20px",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    border: "3px solid #dc2626",
    borderRadius: 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.15s",
    boxShadow: "0 3px 0 #dc2626"
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: 15,
    fontWeight: "bold",
    color: "#10b981",
    textTransform: "uppercase",
    letterSpacing: "2px"
  },
  warning: {
    backgroundColor: "#451a03",
    border: "3px solid #f59e0b",
    padding: 16,
    borderRadius: 0,
    color: "#fbbf24"
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  suggestionItem: {
    display: "flex",
    gap: 12,
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 0,
    border: "2px solid #334155",
    borderLeft: "4px solid #10b981"
  },
  suggestionIcon: {
    fontSize: 20
  },
  suggestionText: {
    margin: 0,
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.6
  },
  statsSection: {
    marginTop: 20,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 0,
    border: "3px solid #334155",
    boxShadow: "0 3px 0 #334155"
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16
  },
  statItem: {
    textAlign: "center",
    padding: 12,
    backgroundColor: "#0f172a",
    border: "2px solid #334155"
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#06b6d4",
    fontFamily: "'Courier New', monospace"
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: "1px",
    fontWeight: "bold"
  },
  setting: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px",
    borderBottom: "2px solid #334155",
    backgroundColor: "#1e293b",
    marginBottom: 8
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#e2e8f0",
    marginBottom: 4,
    letterSpacing: "0.5px"
  },
  settingDesc: {
    fontSize: 11,
    color: "#64748b"
  },
  switch: {
    position: "relative",
    display: "inline-block",
    width: 44,
    height: 24
  },
  dataSection: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 0,
    marginBottom: 16,
    border: "3px solid #334155",
    boxShadow: "0 3px 0 #334155"
  },
  topSites: {
    marginTop: 16
  },
  urlItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 0",
    fontSize: 13,
    color: "#cbd5e1"
  },
  urlRank: {
    fontWeight: "bold",
    marginRight: 8,
    color: "#06b6d4"
  },
  urlText: {
    flex: 1
  },
  tabList: {
    marginBottom: 16
  },
  tabCard: {
    backgroundColor: "#1e293b",
    border: "2px solid #334155",
    borderRadius: 0,
    marginBottom: 12,
    overflow: "hidden"
  },
  tabHeader: {
    display: "flex",
    alignItems: "center",
    padding: 12,
    cursor: "pointer",
    gap: 8,
    backgroundColor: "#334155",
    borderBottom: "2px solid #06b6d4"
  },
  tabInfo: {
    flex: 1
  },
  tabTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#e2e8f0",
    marginBottom: 4,
    letterSpacing: "0.5px"
  },
  tabUrl: {
    fontSize: 11,
    color: "#64748b"
  },
  expandIcon: {
    fontSize: 12,
    color: "#06b6d4",
    width: 16,
    fontWeight: "bold"
  },
  dateList: {
    padding: 8,
    backgroundColor: "#0f172a"
  },
  dateCard: {
    backgroundColor: "#1e293b",
    border: "2px solid #334155",
    borderRadius: 0,
    marginBottom: 8,
    overflow: "hidden"
  },
  dateHeader: {
    display: "flex",
    alignItems: "center",
    padding: 10,
    cursor: "pointer",
    gap: 8,
    backgroundColor: "#334155"
  },
  dateInfo: {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  dateText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#94a3b8",
    letterSpacing: "0.5px"
  },
  countBadge: {
    fontSize: 10,
    padding: "4px 8px",
    backgroundColor: "#10b981",
    color: "#0f172a",
    borderRadius: 0,
    fontWeight: "bold",
    letterSpacing: "0.5px",
    border: "2px solid #059669"
  },
  interactionList: {
    padding: 8,
    backgroundColor: "#0f172a"
  },
  interactionItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 6,
    fontSize: 11,
    borderBottom: "1px solid #1e293b"
  },
  interactionTime: {
    color: "#64748b",
    fontWeight: "bold",
    minWidth: 70,
    fontFamily: "'Courier New', monospace"
  },
  interactionType: {
    color: "#06b6d4",
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: "0.5px"
  },
  interactionDetail: {
    color: "#475569",
    fontSize: 10
  },
  emptyMessage: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    padding: 20,
    fontStyle: "italic"
  }
}

export default IndexPopup
