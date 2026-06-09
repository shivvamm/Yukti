import { useEffect, useRef, useState, type KeyboardEvent } from "react"

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export default function ChatInput({ disabled, onSend }: Props) {
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = () => {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText("")
    if (ref.current) ref.current.style.height = "auto"
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // Auto-grow the textarea up to the CSS max-height.
  const onInput = () => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  const canSend = !disabled && text.trim().length > 0

  return (
    <div className="yk-composer">
      <textarea
        ref={ref}
        className="yk-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={onInput}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Yukti is replying…" : "Ask anything…"}
        disabled={disabled}
        rows={1}
      />
      <button
        className="yk-send"
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  )
}
