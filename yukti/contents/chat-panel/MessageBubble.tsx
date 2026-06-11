import { useState } from "react"
import Markdown from "markdown-to-jsx"
import RobotIcon from "~components/RobotIcon"
import { color } from "~theme"
import type { ChatMessage } from "./types"
import Sources from "./Sources"

interface Props {
  message: ChatMessage
  canRegenerate?: boolean
  onRegenerate?: () => void
}

// markdown-to-jsx only needs to know that links open in a new tab; all
// visual styling lives in the scoped `.yk-md` rules in styles.ts.
const MD_OPTIONS = {
  forceBlock: true,
  overrides: {
    a: { props: { target: "_blank", rel: "noreferrer" } },
  },
}

export default function MessageBubble({ message, canRegenerate, onRegenerate }: Props) {
  const isUser = message.role === "user"
  const isError = !!message.isError
  const isAssistant = !isUser && !isError
  const variant = isError ? "error" : isUser ? "user" : "assistant"
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard blocked (rare on insecure origins) — silently no-op.
    }
  }

  return (
    <div className={`yk-row ${isUser ? "user" : ""}`}>
      {!isUser && (
        <div
          className="yk-avatar"
          style={{
            background: isError ? color.errorSurface : color.canvas,
            border: `1px solid ${isError ? color.errorBorder : color.hairline}`,
          }}>
          <RobotIcon size={18} />
        </div>
      )}
      <div className={`yk-bubble ${variant}`}>
        {isAssistant ? (
          <div className="yk-md">
            <Markdown options={MD_OPTIONS}>{message.content}</Markdown>
          </div>
        ) : (
          message.content
        )}
        {isAssistant && <Sources sources={message.sources || []} />}
        {isAssistant && (
          <div className="yk-msg-actions">
            <button className="yk-msg-action" onClick={onCopy} title="Copy answer">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            {canRegenerate && onRegenerate && (
              <button
                className="yk-msg-action"
                onClick={onRegenerate}
                title="Regenerate answer">
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
