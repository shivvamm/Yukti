import { useEffect, useRef } from "react"
import RobotIcon from "~components/RobotIcon"
import type { ChatMessage } from "./types"
import MessageBubble from "./MessageBubble"

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
  onPrompt: (text: string) => void
  onRegenerate: () => void
}

// Example prompts surfaced in the empty state — one taps the live-page
// path, the others tap RAG history.
const STARTER_PROMPTS = [
  "Summarize this page",
  "What was I reading earlier today?",
  "Find that article I looked at recently",
]

export default function MessageList({ messages, isLoading, onPrompt, onRegenerate }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isLoading])

  // Everything except the seeded welcome message. Empty → show the
  // editorial hero greeting instead of a lone bubble.
  const conversation = messages.filter((m) => m.id !== "welcome")
  const isEmpty = conversation.length === 0

  if (isEmpty && !isLoading) {
    return (
      <div className="yk-list">
        <div className="yk-hero">
          <RobotIcon size={56} />
          <h2 className="yk-hero-title">What can I help you recall?</h2>
          <p className="yk-hero-sub">
            Ask about the page you're on, or anything across your browsing history.
          </p>
          <div className="yk-chips">
            {STARTER_PROMPTS.map((p) => (
              <button key={p} className="yk-chip" onClick={() => onPrompt(p)}>
                {p}
                <span className="yk-chip-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // The last assistant (non-error) message can be regenerated.
  const lastAssistantId = [...conversation]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isError)?.id

  return (
    <div className="yk-list">
      {conversation.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          canRegenerate={!isLoading && m.id === lastAssistantId}
          onRegenerate={onRegenerate}
        />
      ))}
      {isLoading && (
        <div className="yk-think">
          <span className="yk-think-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="yk-think-label">Yukti is thinking…</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
