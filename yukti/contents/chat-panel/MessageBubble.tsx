import Markdown from "markdown-to-jsx"
import RobotIcon from "~components/RobotIcon"
import { color } from "~theme"
import type { ChatMessage } from "./types"
import Sources from "./Sources"

interface Props {
  message: ChatMessage
}

// markdown-to-jsx only needs to know that links open in a new tab; all
// visual styling lives in the scoped `.yk-md` rules in styles.ts.
const MD_OPTIONS = {
  forceBlock: true,
  overrides: {
    a: { props: { target: "_blank", rel: "noreferrer" } },
  },
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user"
  const isError = !!message.isError
  const isAssistant = !isUser && !isError
  const variant = isError ? "error" : isUser ? "user" : "assistant"

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
      </div>
    </div>
  )
}
