import type { ChatMessage } from "./types"
import Sources from "./Sources"

interface Palette {
  bg: string
  fg: string
  border?: string
}

const COLORS: Record<"user" | "assistant" | "error", Palette> = {
  user: { bg: "#0e7490", fg: "#f0f9ff" },
  assistant: { bg: "#1e293b", fg: "#e2e8f0", border: "#334155" },
  error: { bg: "#7f1d1d", fg: "#fecaca", border: "#991b1b" },
}

interface Props {
  message: ChatMessage
}

export default function MessageBubble({ message }: Props) {
  const palette: Palette = message.isError
    ? COLORS.error
    : message.role === "user"
      ? COLORS.user
      : COLORS.assistant

  return (
    <div
      style={{
        display: "flex",
        justifyContent: message.role === "user" ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 12px",
          background: palette.bg,
          color: palette.fg,
          border: palette.border ? `1px solid ${palette.border}` : "none",
          borderRadius: 4,
          fontSize: 13,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
        {message.content}
        {message.role === "assistant" && !message.isError && (
          <Sources sources={message.sources || []} />
        )}
      </div>
    </div>
  )
}
