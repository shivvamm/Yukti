import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_idle"
}

// Privacy-first configuration
const SENSITIVE_INPUT_TYPES = [
  "password",
  "credit-card-number",
  "cc-number",
  "card-number",
  "cardnumber"
]

const BLACKLISTED_DOMAINS = [
  "bank",
  "paypal",
  "stripe",
  "healthcare",
  "medical",
  "health",
  "hospital"
]

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

let isTrackingEnabled = true // Always enabled by default
let pageStartTime = Date.now()
let lastScrollDepth = 0

// Check if tracking is enabled
async function checkTrackingStatus() {
  const result = await chrome.storage.local.get(["trackingEnabled"])
  isTrackingEnabled = result.trackingEnabled !== false // Default to true
}

// Check if current domain is blacklisted
function isBlacklistedDomain(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase()
  return BLACKLISTED_DOMAINS.some((domain) => hostname.includes(domain))
}

// Check if element is sensitive
function isSensitiveInput(element: HTMLElement): boolean {
  if (element.tagName === "INPUT") {
    const input = element as HTMLInputElement
    const type = input.type?.toLowerCase()
    const name = input.name?.toLowerCase()
    const id = input.id?.toLowerCase()
    const autocomplete = input.autocomplete?.toLowerCase()

    // Check input type
    if (SENSITIVE_INPUT_TYPES.some((sensitive) => type?.includes(sensitive))) {
      return true
    }

    // Check name, id, and autocomplete attributes
    if (
      SENSITIVE_INPUT_TYPES.some(
        (sensitive) =>
          name?.includes(sensitive) ||
          id?.includes(sensitive) ||
          autocomplete?.includes(sensitive)
      )
    ) {
      return true
    }
  }
  return false
}

// Send interaction data to background worker
async function recordInteraction(interaction: UserInteraction) {
  if (!isTrackingEnabled || isBlacklistedDomain(window.location.href)) {
    return
  }

  try {
    await chrome.runtime.sendMessage({
      type: "RECORD_INTERACTION",
      data: interaction
    })
    // Debug logging - remove in production if needed
    console.log(`✅ Yukti tracked: ${interaction.type}`, {
      element: interaction.elementType,
      id: interaction.elementId,
      url: new URL(interaction.url).hostname
    })
  } catch (error) {
    console.error("Failed to record interaction:", error)
  }
}

// Click tracking
function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // Skip sensitive elements
  if (isSensitiveInput(target)) {
    return
  }

  // Capture the full HTML of the clicked element (no truncation)
  const elementHTML = target.outerHTML || undefined

  const interaction: UserInteraction = {
    type: "click",
    timestamp: Date.now(),
    url: window.location.href,
    elementType: target.tagName,
    elementId: target.id || undefined,
    elementClass: target.className ? String(target.className) : undefined,
    elementText: target.textContent?.slice(0, 50) || undefined, // Limit text length
    elementHTML: elementHTML
  }

  recordInteraction(interaction)
}

// Scroll tracking
let scrollTimeout: NodeJS.Timeout
function handleScroll() {
  clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    const scrollDepth = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    )

    // Only record if scroll depth changed significantly
    if (Math.abs(scrollDepth - lastScrollDepth) >= 10) {
      lastScrollDepth = scrollDepth

      const interaction: UserInteraction = {
        type: "scroll",
        timestamp: Date.now(),
        url: window.location.href,
        scrollDepth
      }

      recordInteraction(interaction)
    }
  }, 500)
}

// Form interaction tracking (non-sensitive)
function handleFormInteraction(event: Event) {
  const target = event.target as HTMLElement

  // Skip sensitive inputs
  if (isSensitiveInput(target)) {
    return
  }

  const interaction: UserInteraction = {
    type: "form_interaction",
    timestamp: Date.now(),
    url: window.location.href,
    elementType: target.tagName,
    elementId: target.id || undefined
  }

  recordInteraction(interaction)
}

// Input value tracking (captures what user types)
function handleInputValue(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement

  // Skip sensitive inputs - NEVER track passwords
  if (isSensitiveInput(target as HTMLElement)) {
    return
  }

  const interaction: UserInteraction = {
    type: "input_value",
    timestamp: Date.now(),
    url: window.location.href,
    elementType: target.tagName,
    elementId: target.id || undefined,
    elementClass: target.className ? String(target.className) : undefined,
    inputName: target.name || undefined,
    inputValue: target.value || ""
  }

  recordInteraction(interaction)
}

// Track time spent on page
function trackTimeSpent() {
  const timeSpent = Date.now() - pageStartTime

  const interaction: UserInteraction = {
    type: "time_spent",
    timestamp: Date.now(),
    url: window.location.href,
    timeSpent
  }

  recordInteraction(interaction)
}

// Navigation tracking
function handleNavigation() {
  // Record time spent on previous page
  trackTimeSpent()

  // Reset for new page
  pageStartTime = Date.now()
  lastScrollDepth = 0

  const interaction: UserInteraction = {
    type: "navigation",
    timestamp: Date.now(),
    url: window.location.href
  }

  recordInteraction(interaction)
}

// Initialize tracking
async function initializeTracking() {
  await checkTrackingStatus()

  if (!isTrackingEnabled) {
    console.log("Yukti: Tracking is disabled")
    return
  }

  if (isBlacklistedDomain(window.location.href)) {
    console.log("Yukti: Domain is blacklisted for privacy")
    return
  }

  // Add event listeners
  document.addEventListener("click", handleClick, true)
  window.addEventListener("scroll", handleScroll, { passive: true })
  document.addEventListener("focus", handleFormInteraction, true)

  // Track input values (what user types)
  document.addEventListener("input", handleInputValue, true)
  document.addEventListener("change", handleInputValue, true)

  // Track navigation (for SPAs)
  let lastUrl = window.location.href
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      handleNavigation()
    }
  })
  observer.observe(document, { subtree: true, childList: true })

  // Track time spent when page unloads
  window.addEventListener("beforeunload", trackTimeSpent)

  console.log("Yukti: Behavior monitoring initialized")
}

// Extract readable text content from the page
function extractPageContent(): string {
  try {
    // Get main content elements
    const mainContent = document.querySelector('main') ||
                       document.querySelector('article') ||
                       document.querySelector('[role="main"]') ||
                       document.body

    // Extract text, removing scripts, styles, and hidden elements
    const clone = mainContent.cloneNode(true) as HTMLElement

    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer', '[aria-hidden="true"]']
    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove())
    })

    // Get text content
    let text = clone.innerText || clone.textContent || ""

    // Clean up text
    text = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()

    // Limit to first 3000 characters to avoid token limits
    return text.substring(0, 3000)
  } catch (error) {
    console.error("Failed to extract page content:", error)
    return ""
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRACKING_STATUS_CHANGED") {
    checkTrackingStatus()
    sendResponse({ success: true })
  } else if (message.type === "GET_PAGE_CONTENT") {
    // Extract visible text content from the page
    const pageContent = extractPageContent()
    sendResponse({ content: pageContent })
  }
  return true // Keep channel open for async response
})

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTracking)
} else {
  initializeTracking()
}

export {}
