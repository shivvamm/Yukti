import { useState } from "react"
import type { ChatSource } from "./types"

interface Props {
  sources: ChatSource[]
}

export default function Sources({ sources }: Props) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  return (
    <div style={{ marginTop: 8, fontSize: 11 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          color: "#06b6d4",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
          fontSize: 11,
        }}>
        {open ? "▾" : "▸"} Sources ({sources.length})
      </button>
      {open && (
        <ul style={{ listStyle: "none", padding: "6px 0 0 12px", margin: 0 }}>
          {sources.map((s, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#10b981", textDecoration: "none" }}>
                {new URL(s.url).hostname}
              </a>
              <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                — {s.snippet}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
