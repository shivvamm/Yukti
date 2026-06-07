import { useEffect, useRef } from "react"
import type { ChatMessage } from "./types"
import MessageBubble from "./MessageBubble"

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
}

export default function MessageList({ messages, isLoading }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isLoading])

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 12,
        background: "#0f172a",
      }}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {isLoading && (
        <div style={{ padding: "4px 12px", color: "#94a3b8", fontSize: 12 }}>
          Yukti is thinking…
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
