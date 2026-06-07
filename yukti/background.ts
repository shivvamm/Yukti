export {}

interface UserInteraction {
  type: "click" | "scroll" | "navigation" | "form_interaction" | "input_value" | "time_spent" | "tab_opened" | "tab_closed" | "tab_activated"
  timestamp: number
  url: string
  tabId?: number
  windowId?: number
  elementType?: string
  elementId?: string
  elementClass?: string
  elementText?: string
  elementHTML?: string
  inputValue?: string
  inputName?: string
  scrollDepth?: number
  timeSpent?: number
  tabTitle?: string
}

interface UserPattern {
  frequentUrls: { url: string; count: number; lastVisit: number }[]
  commonActions: { type: string; element: string; count: number }[]
  avgTimeSpent: { [url: string]: number }
  scrollBehavior: { [url: string]: number[] }
}

interface TabData {
  tabId: number
  tabTitle: string
  url: string
  dates: {
    [dateKey: string]: UserInteraction[] // dateKey format: "YYYY-MM-DD"
  }
}

interface InteractionsByTab {
  [tabId: string]: TabData
}

const MAX_INTERACTIONS_STORED = 10000 // Limit storage size
const BATCH_SIZE = 30 // Send to server every N interactions
const SERVER_URL = "http://localhost:8000" // Server endpoint
const MIN_SEND_INTERVAL_MS = 15_000 // Don't fire /api/index more often than this

// In-memory single-flight guards for /api/index. Single-threaded JS means
// the synchronous reads-and-claims below are race-free even if many
// recordInteraction callers are awaiting storage I/O concurrently.
let isSendingBatch = false
let lastSendAt = 0

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    trackingEnabled: true, // Always on - tracking starts immediately
    // Opt-out settings: false = track, true = don't track
    disableClicks: false, // Track clicks by default
    disableScrolling: false, // Track scrolling by default
    disableNavigation: false, // Track navigation by default
    disableFormInteractions: false, // Track form focus by default
    disableInputValues: false, // Track input values by default
    interactions: [],
    interactionsByTab: {}, // New hierarchical structure
    patterns: {
      frequentUrls: [],
      commonActions: [],
      avgTimeSpent: {},
      scrollBehavior: {}
    },
    batchCounter: 0, // Counter for batch sending
  })
  console.log("Yukti: Extension installed, tracking everything automatically")
})

// Handle messages from content scripts
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
    askChat(message.payload).then(sendResponse)
    return true
  }
})

// Helper function to format date as YYYY-MM-DD
function getDateKey(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toISOString().split("T")[0]
}

// Record user interaction
async function recordInteraction(interaction: UserInteraction) {
  try {
    const result = await chrome.storage.local.get([
      "interactions",
      "interactionsByTab",
      "disableClicks",
      "disableScrolling",
      "disableNavigation",
      "disableFormInteractions",
      "disableInputValues"
    ])

    const settings = {
      disableClicks: result.disableClicks || false,
      disableScrolling: result.disableScrolling || false,
      disableNavigation: result.disableNavigation || false,
      disableFormInteractions: result.disableFormInteractions || false,
      disableInputValues: result.disableInputValues || false
    }

    // Check if this type of tracking is DISABLED (opt-out logic)
    if (
      (interaction.type === "click" && settings.disableClicks) ||
      (interaction.type === "scroll" && settings.disableScrolling) ||
      (interaction.type === "navigation" && settings.disableNavigation) ||
      (interaction.type === "form_interaction" && settings.disableFormInteractions) ||
      (interaction.type === "input_value" && settings.disableInputValues)
    ) {
      console.log(`⏭️ Yukti: Skipping ${interaction.type} (disabled in settings)`)
      return
    }

    let interactions: UserInteraction[] = result.interactions || []
    let interactionsByTab: InteractionsByTab = result.interactionsByTab || {}

    // Add new interaction to flat array (keep for backward compatibility)
    interactions.push(interaction)
    console.log(`💾 Yukti: Stored ${interaction.type} interaction (Total: ${interactions.length})`)

    // Add to hierarchical structure organized by tab and date
    if (interaction.tabId) {
      const tabKey = interaction.tabId.toString()
      const dateKey = getDateKey(interaction.timestamp)

      // Initialize tab data if doesn't exist
      if (!interactionsByTab[tabKey]) {
        interactionsByTab[tabKey] = {
          tabId: interaction.tabId,
          tabTitle: interaction.tabTitle || "Unknown Tab",
          url: interaction.url,
          dates: {}
        }
      }

      // Update tab title and URL if available
      if (interaction.tabTitle) {
        interactionsByTab[tabKey].tabTitle = interaction.tabTitle
      }
      if (interaction.url) {
        interactionsByTab[tabKey].url = interaction.url
      }

      // Initialize date array if doesn't exist
      if (!interactionsByTab[tabKey].dates[dateKey]) {
        interactionsByTab[tabKey].dates[dateKey] = []
      }

      // Add interaction to the specific date under the tab
      interactionsByTab[tabKey].dates[dateKey].push(interaction)

      console.log(`📋 Yukti: Organized under Tab ${interaction.tabId} → ${dateKey}`)
    }

    // Limit storage size
    if (interactions.length > MAX_INTERACTIONS_STORED) {
      interactions = interactions.slice(-MAX_INTERACTIONS_STORED)
      console.log(`🗑️ Yukti: Trimmed to ${MAX_INTERACTIONS_STORED} interactions`)
    }

    await chrome.storage.local.set({ interactions, interactionsByTab })

    // Update patterns periodically (every 10 interactions)
    if (interactions.length % 10 === 0) {
      console.log("🧠 Yukti: Analyzing patterns...")
      await updatePatterns(interactions)
    }

    // Check if we should send batch to server
    await checkAndSendBatch(interactions.length, interaction)
  } catch (error) {
    console.error("Failed to record interaction:", error)
  }
}

// Check and send batch to server
async function checkAndSendBatch(totalInteractions: number, latestInteraction: UserInteraction) {
  try {
    const result = await chrome.storage.local.get(["batchCounter"])
    const batchCounter = (result.batchCounter || 0) + 1
    await chrome.storage.local.set({ batchCounter })

    if (batchCounter < BATCH_SIZE) return

    // SYNC GUARDS — read-and-claim run between awaits, race-free in single-threaded JS.
    if (isSendingBatch) {
      console.log("⏸️ Yukti: Skipping send — another batch already in flight")
      return
    }
    if (Date.now() - lastSendAt < MIN_SEND_INTERVAL_MS) {
      console.log(`⏸️ Yukti: Skipping send — cooldown (${Math.round((MIN_SEND_INTERVAL_MS - (Date.now() - lastSendAt)) / 1000)}s remaining)`)
      return
    }
    isSendingBatch = true

    try {
      console.log(`🚀 Yukti: Sending batch to server (${batchCounter} interactions)`)
      await sendToServer(latestInteraction)
      await chrome.storage.local.set({ batchCounter: 0 })
      lastSendAt = Date.now()
    } finally {
      isSendingBatch = false
    }
  } catch (error) {
    console.error("Failed to check batch:", error)
    isSendingBatch = false
  }
}

// Send interactions to the server for RAG indexing
async function sendToServer(currentInteraction: UserInteraction) {
  try {
    const result = await chrome.storage.local.get(["interactions"])
    const interactions: UserInteraction[] = result.interactions || []

    // Take last 50 interactions for indexing
    const recentInteractions = interactions.slice(-50)

    const payload = {
      interactions: recentInteractions,
      current_url: currentInteraction.url,
      tab_id: currentInteraction.tabId,
    }

    console.log(`📤 Yukti: Sending ${recentInteractions.length} interactions to /api/index...`)

    const response = await fetch(`${SERVER_URL}/api/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error(`❌ Server error ${response.status}:`, errorData)
      throw new Error(`Server responded with ${response.status}: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    console.log(`✅ Yukti: Indexed ${data.indexed || 0} interactions (skipped ${data.skipped || 0})`)

  } catch (error) {
    console.error("❌ Yukti: Failed to send to server:", error)
  }
}

// Analyze interactions and update patterns
async function updatePatterns(interactions: UserInteraction[]) {
  try {
    const patterns: UserPattern = {
      frequentUrls: [],
      commonActions: [],
      avgTimeSpent: {},
      scrollBehavior: {}
    }

    // Count URL visits
    const urlCounts = new Map<string, { count: number; lastVisit: number }>()
    interactions
      .filter((i) => i.type === "navigation" || i.type === "click")
      .forEach((interaction) => {
        const existing = urlCounts.get(interaction.url) || { count: 0, lastVisit: 0 }
        urlCounts.set(interaction.url, {
          count: existing.count + 1,
          lastVisit: Math.max(existing.lastVisit, interaction.timestamp)
        })
      })

    // Convert to array and sort by count
    patterns.frequentUrls = Array.from(urlCounts.entries())
      .map(([url, data]) => ({ url, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Top 20 URLs

    // Count common actions
    const actionCounts = new Map<string, number>()
    interactions
      .filter((i) => i.type === "click" && i.elementType)
      .forEach((interaction) => {
        const key = `${interaction.elementType}:${interaction.elementId || interaction.elementClass || "unknown"}`
        actionCounts.set(key, (actionCounts.get(key) || 0) + 1)
      })

    patterns.commonActions = Array.from(actionCounts.entries())
      .map(([action, count]) => {
        const [type, element] = action.split(":")
        return { type, element, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Top 20 actions

    // Calculate average time spent per URL
    const timeSpentByUrl = new Map<string, number[]>()
    interactions
      .filter((i) => i.type === "time_spent" && i.timeSpent)
      .forEach((interaction) => {
        const times = timeSpentByUrl.get(interaction.url) || []
        times.push(interaction.timeSpent!)
        timeSpentByUrl.set(interaction.url, times)
      })

    timeSpentByUrl.forEach((times, url) => {
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length
      patterns.avgTimeSpent[url] = Math.round(avg)
    })

    // Analyze scroll behavior
    const scrollByUrl = new Map<string, number[]>()
    interactions
      .filter((i) => i.type === "scroll" && i.scrollDepth !== undefined)
      .forEach((interaction) => {
        const depths = scrollByUrl.get(interaction.url) || []
        depths.push(interaction.scrollDepth!)
        scrollByUrl.set(interaction.url, depths)
      })

    scrollByUrl.forEach((depths, url) => {
      patterns.scrollBehavior[url] = depths
    })

    await chrome.storage.local.set({ patterns })
    console.log("Yukti: Patterns updated", patterns)
  } catch (error) {
    console.error("Failed to update patterns:", error)
  }
}

// Get statistics for display
async function getStats() {
  try {
    const result = await chrome.storage.local.get(["interactions", "patterns"])
    const interactions: UserInteraction[] = result.interactions || []
    const patterns: UserPattern = result.patterns || {
      frequentUrls: [],
      commonActions: [],
      avgTimeSpent: {},
      scrollBehavior: {}
    }

    return {
      totalInteractions: interactions.length,
      topUrls: patterns.frequentUrls.slice(0, 5),
      topActions: patterns.commonActions.slice(0, 5),
      trackingSince: interactions[0]?.timestamp || Date.now()
    }
  } catch (error) {
    console.error("Failed to get stats:", error)
    return null
  }
}

// Notify content scripts when tracking settings change
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.trackingEnabled) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "TRACKING_STATUS_CHANGED"
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          })
        }
      })
    })
  }
})

// Tab lifecycle tracking
chrome.tabs.onCreated.addListener((tab) => {
  const interaction: UserInteraction = {
    type: "tab_opened",
    timestamp: Date.now(),
    url: tab.url || tab.pendingUrl || "about:blank",
    tabId: tab.id,
    windowId: tab.windowId,
    tabTitle: tab.title
  }
  recordInteraction(interaction)
  console.log(`📂 Yukti: Tab opened (ID: ${tab.id})`)
})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const interaction: UserInteraction = {
    type: "tab_closed",
    timestamp: Date.now(),
    url: "", // URL not available on close
    tabId: tabId,
    windowId: removeInfo.windowId
  }
  recordInteraction(interaction)
  console.log(`📕 Yukti: Tab closed (ID: ${tabId})`)
})

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    const interaction: UserInteraction = {
      type: "tab_activated",
      timestamp: Date.now(),
      url: tab.url || "",
      tabId: tab.id,
      windowId: tab.windowId,
      tabTitle: tab.title
    }
    recordInteraction(interaction)
    console.log(`🔄 Yukti: Tab activated (ID: ${tab.id})`)
  })
})

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

console.log("Yukti: Background service worker initialized with tab tracking")
