export {}

interface UserInteraction {
  type: "click" | "scroll" | "navigation" | "form_interaction" | "time_spent"
  timestamp: number
  url: string
  elementType?: string
  elementId?: string
  elementClass?: string
  elementText?: string
  elementHTML?: string
  scrollDepth?: number
  timeSpent?: number
}

interface UserPattern {
  frequentUrls: { url: string; count: number; lastVisit: number }[]
  commonActions: { type: string; element: string; count: number }[]
  avgTimeSpent: { [url: string]: number }
  scrollBehavior: { [url: string]: number[] }
}

const MAX_INTERACTIONS_STORED = 10000 // Limit storage size

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    trackingEnabled: false, // Disabled by default - requires explicit consent
    isPaused: false,
    trackClicks: true,
    trackScrolling: true,
    trackNavigation: true,
    trackFormInteractions: false, // More sensitive, off by default
    interactions: [],
    patterns: {
      frequentUrls: [],
      commonActions: [],
      avgTimeSpent: {},
      scrollBehavior: {}
    }
  })
  console.log("Yukti: Extension installed, tracking disabled by default")
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RECORD_INTERACTION") {
    recordInteraction(message.data)
    sendResponse({ success: true })
  } else if (message.type === "GET_SUGGESTIONS") {
    getSuggestions(message.url).then(sendResponse)
    return true // Will respond asynchronously
  } else if (message.type === "GET_STATS") {
    getStats().then(sendResponse)
    return true
  }
})

// Record user interaction
async function recordInteraction(interaction: UserInteraction) {
  try {
    const result = await chrome.storage.local.get([
      "interactions",
      "trackClicks",
      "trackScrolling",
      "trackNavigation",
      "trackFormInteractions"
    ])

    const settings = {
      trackClicks: result.trackClicks,
      trackScrolling: result.trackScrolling,
      trackNavigation: result.trackNavigation,
      trackFormInteractions: result.trackFormInteractions
    }

    // Check if this type of tracking is enabled
    if (
      (interaction.type === "click" && !settings.trackClicks) ||
      (interaction.type === "scroll" && !settings.trackScrolling) ||
      (interaction.type === "navigation" && !settings.trackNavigation) ||
      (interaction.type === "form_interaction" && !settings.trackFormInteractions)
    ) {
      console.log(`⏭️ Yukti: Skipping ${interaction.type} (disabled in settings)`)
      return
    }

    let interactions: UserInteraction[] = result.interactions || []

    // Add new interaction
    interactions.push(interaction)
    console.log(`💾 Yukti: Stored ${interaction.type} interaction (Total: ${interactions.length})`)

    // Limit storage size
    if (interactions.length > MAX_INTERACTIONS_STORED) {
      interactions = interactions.slice(-MAX_INTERACTIONS_STORED)
      console.log(`🗑️ Yukti: Trimmed to ${MAX_INTERACTIONS_STORED} interactions`)
    }

    await chrome.storage.local.set({ interactions })

    // Update patterns periodically (every 10 interactions)
    if (interactions.length % 10 === 0) {
      console.log("🧠 Yukti: Analyzing patterns...")
      await updatePatterns(interactions)
    }
  } catch (error) {
    console.error("Failed to record interaction:", error)
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

console.log("Yukti: Background service worker initialized")
