import { useState, type KeyboardEvent } from "react"

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export default function ChatInput({ disabled, onSend }: Props) {
  const [text, setText] = useState("")

  const submit = () => {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 8,
        borderTop: "2px solid #334155",
        background: "#1e293b",
      }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Waiting…" : "Ask anything…"}
        disabled={disabled}
        rows={2}
        style={{
          flex: 1,
          padding: 8,
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 4,
          fontSize: 13,
          fontFamily: "inherit",
          resize: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        style={{
          padding: "0 16px",
          background: disabled || !text.trim() ? "#475569" : "#06b6d4",
          color: "#0f172a",
          border: "2px solid #0891b2",
          fontWeight: "bold",
          fontSize: 12,
          cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
        }}>
        {disabled ? "…" : "SEND"}
      </button>
    </div>
  )
}
