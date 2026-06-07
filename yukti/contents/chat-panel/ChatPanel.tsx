import RobotIcon from "~components/RobotIcon"
import type { ChatMessage } from "./types"
import MessageList from "./MessageList"
import ChatInput from "./ChatInput"

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (text: string) => void
  onClose: () => void
}

export default function ChatPanel({ messages, isLoading, onSend, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 380,
        height: 560,
        background: "#0f172a",
        border: "3px solid #06b6d4",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        fontFamily: "ui-monospace, monospace",
        color: "#e2e8f0",
      }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#1e293b",
          borderBottom: "2px solid #334155",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RobotIcon size={28} />
          <span style={{ fontWeight: "bold", color: "#06b6d4", letterSpacing: 1 }}>
            YUKTI
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 18,
            padding: "0 4px",
          }}>
          ×
        </button>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput disabled={isLoading} onSend={onSend} />
    </div>
  )
}
