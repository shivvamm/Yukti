import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState, type MouseEvent } from "react"
import RobotIcon from "~components/RobotIcon"
import { ensureFonts } from "~theme"
import ChatPanel from "./chat-panel/ChatPanel"
import { PANEL_CSS } from "./chat-panel/styles"
import type { ChatMessage, ChatSource } from "./chat-panel/types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
}

const BUBBLE_SIZE = 60

// Per-tab + per-origin conversation persistence. sessionStorage survives a
// reload within the same tab but is isolated to this origin and cleared when
// the tab closes — a good fit for "remember the thread while I'm here".
const STORE_KEY = "yukti.chat.v1"

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — ask me anything about the page you're on, or about anything you've browsed.",
}

// Unique-enough message ids. Date.now() alone collides when we append two
// messages in the same millisecond (e.g. on regenerate).
let _uidSeq = 0
const uid = (prefix: string) => `${prefix}-${Date.now()}-${_uidSeq++}`

interface ChatReply {
  success: boolean
  answer: string | null
  sources: ChatSource[]
  error: string | null
  retry_after: number | null
}

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

const FloatingChatbot = () => {
  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - BUBBLE_SIZE - 16 : 0,
    y: typeof window !== "undefined" ? window.innerHeight - BUBBLE_SIZE - 16 : 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [didDrag, setDidDrag] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Hide Yukti entirely on user-disabled sites and in incognito windows.
  useEffect(() => {
    const host = window.location.hostname.replace(/^www\./, "")
    const inIncognito = !!chrome.extension?.inIncognitoContext
    if (inIncognito) {
      setHidden(true)
      return
    }
    chrome.storage.local.get(["disabledSites"]).then(({ disabledSites = [] }) => {
      setHidden((disabledSites as string[]).includes(host))
    })
    const onChange = (
      changes: { [k: string]: chrome.storage.StorageChange },
      ns: string,
    ) => {
      if (ns === "local" && changes.disabledSites) {
        const list = (changes.disabledSites.newValue || []) as string[]
        setHidden(list.includes(host))
      }
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  // Load the editorial webfonts into the host page once (reachable inside
  // our shadow root). Best-effort — falls back to Georgia/system if a
  // strict host CSP blocks Google Fonts.
  useEffect(() => {
    ensureFonts()
  }, [])

  // ── drag ──────────────────────────────────────────────────────────
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    setDidDrag(false)
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: globalThis.MouseEvent) => {
      setDidDrag(true)
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isDragging, dragOffset])

  // ── bubble click toggle ──────────────────────────────────────────
  const onBubbleClick = () => {
    if (didDrag) return  // suppress click after a drag
    setIsOpen((v) => !v)
  }

  // ── click-outside to close ────────────────────────────────────────
  // The panel lives in a shadow root, so a normal target check fails
  // (events retarget to the host at the boundary). composedPath() gives
  // the full path including our shadow nodes — close unless the click
  // landed inside `.yk-panel`.
  useEffect(() => {
    if (!isOpen) return
    const onDocDown = (e: globalThis.MouseEvent) => {
      const path = (e.composedPath?.() || []) as EventTarget[]
      const insidePanel = path.some(
        (n) => n instanceof HTMLElement && n.classList?.contains("yk-panel")
      )
      if (!insidePanel) setIsOpen(false)
    }
    window.addEventListener("mousedown", onDocDown, true)
    return () => window.removeEventListener("mousedown", onDocDown, true)
  }, [isOpen])

  // ── persistence ──────────────────────────────────────────────────
  // Restore the thread for this tab/origin on mount; persist on every change.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed)
      }
    } catch {
      // Corrupt/blocked storage — start fresh.
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages))
    } catch {
      // Quota or privacy mode — persistence is best-effort.
    }
  }, [messages])

  // ── history derivation ───────────────────────────────────────────
  const historyFrom = (msgs: ChatMessage[]) =>
    msgs
      .filter((m) => m.id !== "welcome" && !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))

  // Core round-trip to the background worker → server. Returns the assistant
  // (or error/retry) message to append. Shared by send, regenerate, and the
  // external triggers (context menu / omnibox / keyboard shortcut).
  const callChat = async (
    question: string,
    history: { role: string; content: string }[],
  ): Promise<ChatMessage> => {
    // Capture the selection BEFORE awaiting (focus moves to our input on send).
    const selection = getSelectionText()
    let pageText = await extractPageText()
    // Anchor relative-date questions ("yesterday") to the user's real clock —
    // the server has no other notion of "now". Cheap, works without a deploy.
    const nowLine = `[CURRENT LOCAL TIME] ${new Date().toString()}`
    const selBlock = selection
      ? `[SELECTED TEXT — the user is likely asking about this]\n${selection}\n\n`
      : ""
    pageText = `${nowLine}\n\n${selBlock}${pageText}`

    try {
      const reply: ChatReply = await chrome.runtime.sendMessage({
        type: "ASK_CHAT",
        payload: {
          question,
          current_url: window.location.href,
          current_page_text: pageText,
          chat_history: history,
        },
      })
      if (reply.success && reply.answer) {
        return {
          id: uid("a"),
          role: "assistant",
          content: reply.answer,
          sources: reply.sources || [],
        }
      }
      if (reply.retry_after) {
        const secs = reply.retry_after
        const wait =
          secs < 60 ? `${secs} seconds`
          : secs < 3600 ? `${Math.ceil(secs / 60)} minute${secs >= 120 ? "s" : ""}`
          : `${Math.round(secs / 3600)} hour${secs >= 7200 ? "s" : ""}`
        return {
          id: uid("r"),
          role: "assistant",
          content: `I'm being rate-limited right now. Please try again in about ${wait}.`,
        }
      }
      return {
        id: uid("e"),
        role: "assistant",
        content: reply.error || "Sorry, I couldn't get an answer.",
        isError: true,
      }
    } catch (e) {
      return {
        id: uid("e"),
        role: "assistant",
        content:
          e instanceof Error ? `Couldn't reach Yukti: ${e.message}` : "Couldn't reach Yukti.",
        isError: true,
      }
    }
  }

  // ── chat send ────────────────────────────────────────────────────
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

  // Re-answer the most recent question: drop the trailing assistant reply and
  // ask again with the same prior history.
  const onRegenerate = async () => {
    if (isLoading) return
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx === -1) return
    const question = messages[lastUserIdx].content
    const kept = messages.slice(0, lastUserIdx + 1)
    const history = historyFrom(messages.slice(0, lastUserIdx))
    setMessages(kept)
    setIsLoading(true)
    const bot = await callChat(question, history)
    setMessages((m) => [...m, bot])
    setIsLoading(false)
  }

  // Clear the thread back to the welcome state.
  const onClear = () => {
    if (isLoading) return
    setMessages([WELCOME_MESSAGE])
    try {
      sessionStorage.removeItem(STORE_KEY)
    } catch {
      // ignore
    }
  }

  // ── external triggers ────────────────────────────────────────────
  // Keep a ref to the latest onSend so the (stable) message listener can call
  // it without re-subscribing on every render.
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  useEffect(() => {
    const listener = (msg: { type?: string; text?: string }) => {
      if (msg?.type === "YK_OPEN_CHAT") {
        setIsOpen(true)
      } else if (msg?.type === "YK_ASK" && msg.text) {
        setIsOpen(true)
        onSendRef.current(msg.text)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // ── render ───────────────────────────────────────────────────────
  // Disabled site or incognito → render nothing at all.
  if (hidden) return null

  return (
    <div className="yk-root">
      <style>{PANEL_CSS}</style>
      {!isOpen && (
        <div
          onMouseDown={onMouseDown}
          onClick={onBubbleClick}
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            cursor: isDragging ? "grabbing" : "grab",
            zIndex: 2147483646,
            userSelect: "none",
          }}>
          <RobotIcon size={BUBBLE_SIZE} />
        </div>
      )}
      {isOpen && (
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={onSend}
          onRegenerate={onRegenerate}
          onClear={onClear}
          onSummarize={() =>
            onSend("Summarize this page in a few concise bullet points.")
          }
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// ── page-text extraction ───────────────────────────────────────────
//
// We wait until the page has fully loaded, then snapshot the DOM once — no
// scrolling, so the user's browsing is never interrupted. On top of the raw
// <body> innerText we layer structured signals the model can't otherwise see:
// page metadata + a headings outline, tables rendered as markdown, image alt
// text, and the text of same-origin iframes. (Lazy-load / infinite-scroll /
// native PDFs / canvas apps like Google Sheets stay out of scope — we never
// touch the page to coax more content out of it.)

const LOAD_TIMEOUT_MS = 2_000 // max wait for the page to finish loading
const MAX_PAGE_TEXT_BYTES = 500_000 // hard ceiling on the assembled payload

/** Resolve once the page has finished loading, or after a timeout — so we
 *  capture a complete DOM, and never hang on a page that never settles. */
async function waitForFullLoad(): Promise<void> {
  if (document.readyState === "complete") return
  await new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.removeEventListener("load", finish)
      resolve()
    }
    window.addEventListener("load", finish)
    setTimeout(finish, LOAD_TIMEOUT_MS)
  })
}

/** Collapse whitespace the same way the original single-snapshot path did. */
function normalize(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

/** The user's current text selection, if any — lets us answer "explain this"
 *  about exactly what they highlighted. Empty string when nothing is selected. */
export function getSelectionText(): string {
  try {
    return (window.getSelection()?.toString() || "").trim()
  } catch {
    return ""
  }
}

/** <meta> description / OpenGraph summary + an h1–h3 outline. Gives the model
 *  the page's "shape" without it having to infer structure from a flat blob. */
function extractMetadata(): string {
  const out: string[] = []
  const meta = (sel: string) =>
    (document.querySelector(sel) as HTMLMetaElement | null)?.content?.trim() || ""
  const desc = meta('meta[name="description"]') || meta('meta[property="og:description"]')
  const ogTitle = meta('meta[property="og:title"]')
  const ogSite = meta('meta[property="og:site_name"]')
  if (ogSite) out.push(`Site: ${ogSite}`)
  if (ogTitle) out.push(`Title: ${ogTitle}`)
  if (desc) out.push(`Description: ${desc}`)

  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((h) => {
      const level = Number(h.tagName[1])
      const text = (h as HTMLElement).innerText.trim()
      return text ? `${"  ".repeat(level - 1)}- ${text}` : ""
    })
    .filter(Boolean)
    .slice(0, 60)
  if (headings.length) out.push("Outline:\n" + headings.join("\n"))

  return out.length ? "[PAGE METADATA]\n" + out.join("\n") : ""
}

/** Render every <table> as markdown so the model can reason over rows/columns
 *  instead of the column-less mush innerText produces for tabular data. */
function extractTables(): string {
  const tables = Array.from(document.querySelectorAll("table")).slice(0, 8)
  const blocks: string[] = []
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll("tr")).slice(0, 60)
    const md: string[] = []
    rows.forEach((tr, i) => {
      const cells = Array.from(tr.querySelectorAll("th, td")).map((c) =>
        (c as HTMLElement).innerText.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|"),
      )
      if (!cells.length) return
      md.push("| " + cells.join(" | ") + " |")
      if (i === 0) md.push("| " + cells.map(() => "---").join(" | ") + " |")
    })
    if (md.length > 1) blocks.push(md.join("\n"))
  }
  return blocks.length ? "[TABLES]\n" + blocks.join("\n\n") : ""
}

/** Alt text for content images — innerText drops it, but it often carries the
 *  only description of charts, diagrams, and product shots. */
function extractImageAltText(): string {
  const alts = Array.from(document.querySelectorAll("img[alt]"))
    .map((img) => (img as HTMLImageElement).alt.trim())
    .filter((a) => a.length > 2)
  const unique = Array.from(new Set(alts)).slice(0, 40)
  return unique.length ? "[IMAGE DESCRIPTIONS]\n" + unique.map((a) => `- ${a}`).join("\n") : ""
}

/** Text inside same-origin iframes. Cross-origin frames throw on access and
 *  are silently skipped — that's a browser security boundary, not a bug. */
function extractIframeText(): string {
  const frames = Array.from(document.querySelectorAll("iframe")).slice(0, 6)
  const chunks: string[] = []
  for (const frame of frames) {
    try {
      const doc = (frame as HTMLIFrameElement).contentDocument
      const text = doc?.body?.innerText?.trim()
      if (text && text.length > 20) chunks.push(text)
    } catch {
      // Cross-origin — unreadable by design. Skip.
    }
  }
  return chunks.length ? "[EMBEDDED FRAMES]\n" + chunks.join("\n\n") : ""
}

/** Extract the page's content after it has fully loaded.
 *
 * Layers structured signals (metadata, tables, alt text, iframes) on top of the
 * whole-<body> innerText. innerText respects display:none / visibility:hidden,
 * so hidden content (and <script>/<style>) is excluded automatically. The page
 * is never scrolled or modified. Bounded by MAX_PAGE_TEXT_BYTES. */
async function extractPageText(): Promise<string> {
  if (!document.body) return ""
  try {
    await waitForFullLoad()
  } catch {
    // Ignore — fall through to whatever is currently in the DOM.
  }

  try {
    const title = document.title ? `${document.title}\n` : ""
    const sections = [
      extractMetadata(),
      "[PAGE CONTENT]\n" + (document.body.innerText || ""),
      extractTables(),
      extractImageAltText(),
      extractIframeText(),
    ].filter(Boolean)
    return normalize(title + sections.join("\n\n")).slice(0, MAX_PAGE_TEXT_BYTES)
  } catch {
    // Any DOM quirk → fall back to the original plain snapshot.
    const title = document.title ? `${document.title}\n\n` : ""
    return normalize(title + (document.body.innerText || "")).slice(0, MAX_PAGE_TEXT_BYTES)
  }
}

export default FloatingChatbot
