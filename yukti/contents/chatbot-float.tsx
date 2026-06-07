import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, type MouseEvent } from "react"
import RobotIcon from "~components/RobotIcon"
import ChatPanel from "./chat-panel/ChatPanel"
import type { ChatMessage, ChatSource } from "./chat-panel/types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
}

const BUBBLE_SIZE = 64
const PAGE_TEXT_LIMIT = 3000  // chars sent to /api/chat as current_page_text

interface ChatReply {
  success: boolean
  answer: string | null
  sources: ChatSource[]
  error: string | null
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — ask me anything about the page you're on, or about anything you've browsed.",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)

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

  // ── chat send ────────────────────────────────────────────────────
  const onSend = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    }
    const history = messages
      .filter((m) => m.id !== "welcome" && !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((m) => [...m, userMsg])
    setIsLoading(true)

    const pageText = extractPageText().slice(0, PAGE_TEXT_LIMIT)

    try {
      const reply: ChatReply = await chrome.runtime.sendMessage({
        type: "ASK_CHAT",
        payload: {
          question: text,
          current_url: window.location.href,
          current_page_text: pageText,
          chat_history: history,
        },
      })
      const botMsg: ChatMessage = reply.success && reply.answer
        ? {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: reply.answer,
            sources: reply.sources || [],
          }
        : {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: reply.error || "Sorry, I couldn't get an answer.",
            isError: true,
          }
      setMessages((m) => [...m, botMsg])
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content:
            e instanceof Error
              ? `Couldn't reach Yukti: ${e.message}`
              : "Couldn't reach Yukti.",
          isError: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // ── render ───────────────────────────────────────────────────────
  return (
    <>
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
        <RobotIcon />
      </div>
      {isOpen && (
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={onSend}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

/** Extract visible page text. Synchronous, content-script context. */
function extractPageText(): string {
  const main = document.querySelector("main")
  const root = main ?? document.body
  if (!root) return ""
  return (root.innerText || "").replace(/\s+/g, " ").trim()
}

export default FloatingChatbot
