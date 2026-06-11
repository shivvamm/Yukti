import RobotIcon from "~components/RobotIcon"
import type { ChatMessage } from "./types"
import MessageList from "./MessageList"
import ChatInput from "./ChatInput"

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (text: string) => void
  onRegenerate: () => void
  onClear: () => void
  onSummarize: () => void
  onClose: () => void
}

export default function ChatPanel({
  messages,
  isLoading,
  onSend,
  onRegenerate,
  onClear,
  onSummarize,
  onClose,
}: Props) {
  // Host pages like GitHub bind global keydown listeners (e.g. `/` opens search).
  // Stop key events at the panel boundary so the host never sees keystrokes
  // typed inside the chat. stopPropagation() is enough — we don't preventDefault,
  // so our own inputs still receive the events normally.
  const stopKey = (e: React.KeyboardEvent) => e.stopPropagation()

  return (
    <div
      className="yk-panel"
      onKeyDown={stopKey}
      onKeyUp={stopKey}
      onKeyPress={stopKey}>
      <header className="yk-header">
        <div className="yk-brand">
          <RobotIcon size={30} />
          <span className="yk-wordmark">Yukti</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
          <button
            className="yk-action"
            onClick={onSummarize}
            disabled={isLoading}
            title="Summarize this page"
            aria-label="Summarize this page">
            Summarize
          </button>
          <button
            className="yk-action"
            onClick={onClear}
            disabled={isLoading}
            title="New conversation"
            aria-label="New conversation">
            New
          </button>
          <button className="yk-close" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        </div>
      </header>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        onPrompt={onSend}
        onRegenerate={onRegenerate}
      />
      <ChatInput disabled={isLoading} onSend={onSend} />
    </div>
  )
}
