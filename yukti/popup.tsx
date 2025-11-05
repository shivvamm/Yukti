import { useEffect, useState } from "react"

interface Stats {
  totalInteractions: number
  topUrls: { url: string; count: number }[]
  topActions: { type: string; element: string; count: number }[]
  trackingSince: number
}

type Tab = "home" | "settings" | "data" | "about"

function IndexPopup() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showConsent, setShowConsent] = useState(false)

  // Settings
  const [trackClicks, setTrackClicks] = useState(true)
  const [trackScrolling, setTrackScrolling] = useState(true)
  const [trackNavigation, setTrackNavigation] = useState(true)
  const [trackFormInteractions, setTrackFormInteractions] = useState(false)

  // Load initial state
  useEffect(() => {
    loadSettings()
    loadSuggestions()
    loadStats()
  }, [])

  async function loadSettings() {
    const result = await chrome.storage.local.get([
      "trackingEnabled",
      "isPaused",
      "trackClicks",
      "trackScrolling",
      "trackNavigation",
      "trackFormInteractions"
    ])

    setTrackingEnabled(result.trackingEnabled || false)
    setIsPaused(result.isPaused || false)
    setTrackClicks(result.trackClicks !== false)
    setTrackScrolling(result.trackScrolling !== false)
    setTrackNavigation(result.trackNavigation !== false)
    setTrackFormInteractions(result.trackFormInteractions || false)

    // Show consent if never set
    if (result.trackingEnabled === undefined) {
      setShowConsent(true)
    }
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

  async function handleConsentAccept() {
    await chrome.storage.local.set({ trackingEnabled: true })
    setTrackingEnabled(true)
    setShowConsent(false)
    loadSuggestions()
  }

  async function handleConsentDecline() {
    await chrome.storage.local.set({ trackingEnabled: false })
    setTrackingEnabled(false)
    setShowConsent(false)
  }

  async function toggleTracking() {
    const newValue = !trackingEnabled
    await chrome.storage.local.set({ trackingEnabled: newValue })
    setTrackingEnabled(newValue)
    if (newValue) {
      loadSuggestions()
    }
  }

  async function togglePause() {
    const newValue = !isPaused
    await chrome.storage.local.set({ isPaused: newValue })
    setIsPaused(newValue)

    // Notify content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: newValue ? "PAUSE_TRACKING" : "RESUME_TRACKING"
          })
        }
      })
    })
  }

  async function updateSetting(key: string, value: boolean) {
    await chrome.storage.local.set({ [key]: value })

    switch (key) {
      case "trackClicks":
        setTrackClicks(value)
        break
      case "trackScrolling":
        setTrackScrolling(value)
        break
      case "trackNavigation":
        setTrackNavigation(value)
        break
      case "trackFormInteractions":
        setTrackFormInteractions(value)
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

  if (showConsent) {
    return (
      <div style={styles.container}>
        <div style={styles.consent}>
          <h2 style={styles.title}>Welcome to Yukti</h2>
          <p style={styles.text}>
            Yukti learns from your browsing behavior to provide intelligent suggestions.
          </p>

          <div style={styles.consentSection}>
            <h3 style={styles.subtitle}>What we track:</h3>
            <ul style={styles.list}>
              <li>Pages you visit</li>
              <li>Elements you click</li>
              <li>Scroll behavior</li>
              <li>Time spent on pages</li>
            </ul>
          </div>

          <div style={styles.consentSection}>
            <h3 style={styles.subtitle}>Privacy guarantees:</h3>
            <ul style={styles.list}>
              <li>All data stays on YOUR device</li>
              <li>No password or payment info tracked</li>
              <li>Banking/healthcare sites blocked</li>
              <li>You can delete data anytime</li>
            </ul>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleConsentAccept} style={styles.primaryButton}>
              Accept & Enable
            </button>
            <button onClick={handleConsentDecline} style={styles.secondaryButton}>
              Decline
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.mainTitle}>Yukti</h1>
        <div style={styles.statusBadge}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: trackingEnabled && !isPaused ? "#10b981" : "#ef4444"
            }}
          />
          {trackingEnabled ? (isPaused ? "Paused" : "Active") : "Disabled"}
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
            {!trackingEnabled ? (
              <div style={styles.warning}>
                <p>Tracking is disabled. Enable it in Settings to get suggestions.</p>
              </div>
            ) : (
              <div style={styles.suggestions}>
                {suggestions.map((suggestion, index) => (
                  <div key={index} style={styles.suggestionItem}>
                    <span style={styles.suggestionIcon}>💡</span>
                    <p style={styles.suggestionText}>{suggestion}</p>
                  </div>
                ))}
              </div>
            )}

            {stats && trackingEnabled && (
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

            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Enable Tracking</div>
                <div style={styles.settingDesc}>Allow Yukti to learn from your behavior</div>
              </div>
              <label style={styles.switch}>
                <input type="checkbox" checked={trackingEnabled} onChange={toggleTracking} />
                <span style={styles.slider}></span>
              </label>
            </div>

            {trackingEnabled && (
              <>
                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Pause Tracking</div>
                    <div style={styles.settingDesc}>Temporarily stop tracking</div>
                  </div>
                  <label style={styles.switch}>
                    <input type="checkbox" checked={isPaused} onChange={togglePause} />
                    <span style={styles.slider}></span>
                  </label>
                </div>

                <h3 style={styles.subtitle}>What to Track</h3>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Clicks</div>
                    <div style={styles.settingDesc}>Track elements you click</div>
                  </div>
                  <label style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={trackClicks}
                      onChange={(e) => updateSetting("trackClicks", e.target.checked)}
                    />
                    <span style={styles.slider}></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Scrolling</div>
                    <div style={styles.settingDesc}>Track scroll depth on pages</div>
                  </div>
                  <label style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={trackScrolling}
                      onChange={(e) => updateSetting("trackScrolling", e.target.checked)}
                    />
                    <span style={styles.slider}></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Navigation</div>
                    <div style={styles.settingDesc}>Track pages you visit</div>
                  </div>
                  <label style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={trackNavigation}
                      onChange={(e) => updateSetting("trackNavigation", e.target.checked)}
                    />
                    <span style={styles.slider}></span>
                  </label>
                </div>

                <div style={styles.setting}>
                  <div>
                    <div style={styles.settingLabel}>Form Interactions</div>
                    <div style={styles.settingDesc}>
                      Track non-sensitive form fields (passwords excluded)
                    </div>
                  </div>
                  <label style={styles.switch}>
                    <input
                      type="checkbox"
                      checked={trackFormInteractions}
                      onChange={(e) => updateSetting("trackFormInteractions", e.target.checked)}
                    />
                    <span style={styles.slider}></span>
                  </label>
                </div>
              </>
            )}
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

                {stats.topUrls.length > 0 && (
                  <div style={styles.topSites}>
                    <h3 style={styles.subtitle}>Top Sites</h3>
                    {stats.topUrls.map((url, index) => (
                      <div key={index} style={styles.urlItem}>
                        <span style={styles.urlRank}>{index + 1}.</span>
                        <span style={styles.urlText}>
                          {new URL(url.url).hostname} ({url.count} visits)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
    width: 450,
    minHeight: 500,
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f9fafb",
    color: "#111827"
  },
  header: {
    backgroundColor: "#4f46e5",
    color: "white",
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  mainTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: "bold"
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: "6px 12px",
    borderRadius: 16,
    fontSize: 14
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
    padding: "12px 16px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: 14,
    color: "#6b7280",
    borderBottom: "2px solid transparent",
    transition: "all 0.2s"
  },
  tabActive: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: 14,
    color: "#4f46e5",
    borderBottom: "2px solid #4f46e5",
    fontWeight: 600
  },
  content: {
    padding: 20,
    maxHeight: 400,
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
    margin: "0 0 16px 0",
    fontSize: 20,
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
  }
}

export default IndexPopup
