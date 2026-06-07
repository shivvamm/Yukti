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
    <div className="yk-panel">
      <header className="yk-header">
        <div className="yk-brand">
          <RobotIcon size={30} />
          <span className="yk-wordmark">Yukti</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <span className="yk-status">
            <span className="yk-dot" />
            online
          </span>
          <button className="yk-close" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        </div>
      </header>

      <MessageList messages={messages} isLoading={isLoading} onPrompt={onSend} />
      <ChatInput disabled={isLoading} onSend={onSend} />
    </div>
  )
}
