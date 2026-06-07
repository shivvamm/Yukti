import Markdown from "markdown-to-jsx"
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

// Minimal overrides — let the library handle structure; we only fix the
// elements whose browser defaults look out of place in the bubble (code
// needs a background; links need our accent color; tight margins).
const MD_OPTIONS = {
  forceBlock: true,
  overrides: {
    a: {
      props: {
        target: "_blank",
        rel: "noreferrer",
        style: { color: "#10b981", textDecoration: "underline" },
      },
    },
    code: { props: { style: { background: "#0f172a", color: "#67e8f9", padding: "1px 5px", borderRadius: 3 } } },
    pre: { props: { style: { background: "#0f172a", padding: 8, borderRadius: 4, overflowX: "auto" as const, margin: "6px 0" } } },
    p: { props: { style: { margin: "4px 0" } } },
    ul: { props: { style: { margin: "4px 0", paddingLeft: 18 } } },
    ol: { props: { style: { margin: "4px 0", paddingLeft: 20 } } },
    li: { props: { style: { margin: "2px 0" } } },
    h1: { props: { style: { fontSize: 16, color: "#06b6d4", margin: "10px 0 6px" } } },
    h2: { props: { style: { fontSize: 15, color: "#06b6d4", margin: "10px 0 4px" } } },
    h3: { props: { style: { fontSize: 14, color: "#06b6d4", margin: "8px 0 4px" } } },
  },
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

  // Render markdown only for assistant replies (not the user's own typed text
  // or error notices, which should stay verbatim).
  const renderAsMarkdown = message.role === "assistant" && !message.isError

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
          lineHeight: 1.45,
          whiteSpace: renderAsMarkdown ? "normal" : "pre-wrap",
          wordBreak: "break-word",
        }}>
        {renderAsMarkdown ? (
          <Markdown options={MD_OPTIONS}>{message.content}</Markdown>
        ) : (
          message.content
        )}
        {message.role === "assistant" && !message.isError && (
          <Sources sources={message.sources || []} />
        )}
      </div>
    </div>
  )
}
