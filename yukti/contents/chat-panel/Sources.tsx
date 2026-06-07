import { useState } from "react"
import SpikeMark from "~components/SpikeMark"
import type { ChatSource } from "./types"

interface Props {
  sources: ChatSource[]
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export default function Sources({ sources }: Props) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  return (
    <div className="yk-src">
      <button className="yk-src-toggle" onClick={() => setOpen(!open)}>
        <SpikeMark size={11} />
        {sources.length} source{sources.length === 1 ? "" : "s"}
        <span style={{ opacity: 0.6 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="yk-src-list">
          {sources.map((s, i) => (
            <li key={i} className="yk-src-item">
              <a className="yk-src-host" href={s.url} target="_blank" rel="noreferrer">
                {hostOf(s.url)}
              </a>
              <span className="yk-src-snip">{s.snippet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
