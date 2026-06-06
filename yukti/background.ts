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
    serverSuggestions: [] // Store suggestions from server
  })
  console.log("Yukti: Extension installed, tracking everything automatically")
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORD_INTERACTION") {
    // Add tab information from sender
    const interaction = message.data
    if (sender.tab) {
      interaction.tabId = sender.tab.id
      interaction.windowId = sender.tab.windowId
      interaction.tabTitle = sender.tab.title
    }
    recordInteraction(interaction)
    sendResponse({ success: true })
  } else if (message.type === "GET_SUGGESTIONS") {
    getSuggestions(message.url).then(sendResponse)
    return true // Will respond asynchronously
  } else if (message.type === "GET_STATS") {
    getStats().then(sendResponse)
    return true
  } else if (message.type === "GET_SERVER_SUGGESTIONS") {
    getServerSuggestions().then(sendResponse)
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
    let batchCounter = result.batchCounter || 0
    batchCounter++

    await chrome.storage.local.set({ batchCounter })

    // Send to server every BATCH_SIZE interactions
    if (batchCounter >= BATCH_SIZE) {
      console.log(`🚀 Yukti: Sending batch to server (${batchCounter} interactions)`)
      await sendToServer(latestInteraction)
      await chrome.storage.local.set({ batchCounter: 0 }) // Reset counter
    }
  } catch (error) {
    console.error("Failed to check batch:", error)
  }
}

// Send interactions to server for AI analysis
async function sendToServer(currentInteraction: UserInteraction) {
  try {
    const result = await chrome.storage.local.get(["interactions"])
    const interactions: UserInteraction[] = result.interactions || []

    // Take last 50 interactions for analysis
    const recentInteractions = interactions.slice(-50)

    // Extract current page content
    let pageContent = ""
    try {
      if (currentInteraction.tabId) {
        const response = await chrome.tabs.sendMessage(currentInteraction.tabId, {
          type: "GET_PAGE_CONTENT"
        })
        pageContent = response?.content || ""
      }
    } catch (error) {
      console.warn("Could not extract page content:", error)
    }

    // Prepare request payload
    const payload = {
      interactions: recentInteractions,
      current_url: currentInteraction.url,
      tab_id: currentInteraction.tabId,
      page_content: pageContent,
      timestamp: Date.now()
    }

    console.log(`📤 Yukti: Sending ${recentInteractions.length} interactions to server...`)
    console.log(`📋 Yukti: Page content: ${pageContent.length} characters`)
    console.log(`📋 Yukti: Payload:`, { ...payload, page_content: `${pageContent.substring(0, 100)}...` })

    // Call server API
    const response = await fetch(`${SERVER_URL}/api/analyze`, {
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

    console.log(`✅ Yukti: Received response from server`)
    console.log(`   Suggestions: ${data.suggestions?.length || 0}`)
    console.log(`   Confidence: ${data.confidence?.toFixed(2) || 0}`)

    // Store suggestions for chatbot to retrieve
    await chrome.storage.local.set({
      serverSuggestions: data.suggestions || [],
      lastServerUpdate: Date.now()
    })

    // Notify chatbot about new suggestions
    notifyChatbot()

  } catch (error) {
    console.error("❌ Yukti: Failed to send to server:", error)
    // Store error for chatbot to display
    await chrome.storage.local.set({
      serverError: error.message,
      serverSuggestions: []
    })
  }
}

// Notify chatbot about new suggestions
function notifyChatbot() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SERVER_SUGGESTIONS_UPDATED"
        }).catch(() => {
          // Ignore errors for tabs without content script
        })
      }
    })
  })
}

// Get server suggestions (called by chatbot)
async function getServerSuggestions() {
  try {
    const result = await chrome.storage.local.get([
      "serverSuggestions",
      "lastServerUpdate",
      "serverError"
    ])

    return {
      suggestions: result.serverSuggestions || [],
      lastUpdate: result.lastServerUpdate || null,
      error: result.serverError || null
    }
  } catch (error) {
    console.error("Failed to get server suggestions:", error)
    return {
      suggestions: [],
      lastUpdate: null,
      error: error.message
    }
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

// Get AI suggestions based on current URL and patterns
async function getSuggestions(currentUrl: string): Promise<string[]> {
  try {
    const result = await chrome.storage.local.get(["patterns", "interactions"])
    const patterns: UserPattern = result.patterns || {
      frequentUrls: [],
      commonActions: [],
      avgTimeSpent: {},
      scrollBehavior: {}
    }
    const interactions: UserInteraction[] = result.interactions || []

    const suggestions: string[] = []

    // Suggestion 1: Frequently visited sites
    const topUrls = patterns.frequentUrls.slice(0, 3)
    if (topUrls.length > 0) {
      suggestions.push(
        `You frequently visit: ${topUrls.map((u) => new URL(u.url).hostname).join(", ")}`
      )
    }

    // Suggestion 2: Time spent analysis
    const currentUrlTimeSpent = patterns.avgTimeSpent[currentUrl]
    if (currentUrlTimeSpent) {
      const minutes = Math.round(currentUrlTimeSpent / 1000 / 60)
      suggestions.push(`You typically spend ${minutes} minutes on this page`)
    }

    // Suggestion 3: Scroll behavior
    const scrollDepths = patterns.scrollBehavior[currentUrl]
    if (scrollDepths && scrollDepths.length > 5) {
      const avgScroll = scrollDepths.reduce((sum, d) => sum + d, 0) / scrollDepths.length
      if (avgScroll < 30) {
        suggestions.push("You usually don't scroll much on this page - content below might not interest you")
      } else if (avgScroll > 80) {
        suggestions.push("You typically read this entire page - there might be interesting content below")
      }
    }

    // Suggestion 4: Similar pages visited
    const currentDomain = new URL(currentUrl).hostname
    const sameDomainVisits = patterns.frequentUrls.filter((u) =>
      new URL(u.url).hostname.includes(currentDomain)
    )
    if (sameDomainVisits.length > 1) {
      suggestions.push(`You've visited ${sameDomainVisits.length} pages on this site`)
    }

    // Suggestion 5: Recent activity pattern
    const recentInteractions = interactions.slice(-100)
    const recentClicks = recentInteractions.filter((i) => i.type === "click").length
    if (recentClicks > 50) {
      suggestions.push("You've been very active recently - consider taking a break")
    }

    // Default suggestion if no patterns yet
    if (suggestions.length === 0) {
      suggestions.push("Keep browsing! I'm learning your patterns to provide better suggestions.")
    }

    return suggestions
  } catch (error) {
    console.error("Failed to get suggestions:", error)
    return ["Error loading suggestions"]
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

console.log("Yukti: Background service worker initialized with tab tracking")
