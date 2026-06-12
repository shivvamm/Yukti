import { useEffect, useState } from "react"
import RobotIcon from "~components/RobotIcon"
import SpikeMark from "~components/SpikeMark"
import { color, font, ensureFonts } from "~theme"

const CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: "disableClicks", label: "Clicks", desc: "Elements you click on" },
  { key: "disableScrolling", label: "Scrolling", desc: "Scroll depth on pages" },
  { key: "disableNavigation", label: "Navigation", desc: "Pages you visit" },
  { key: "disableFormInteractions", label: "Form focus", desc: "When you focus form fields" },
  { key: "disableInputValues", label: "Input values", desc: "What you type (passwords never tracked)" },
]

function Onboarding() {
  const [disabled, setDisabled] = useState<{ [k: string]: boolean }>({})
  const [done, setDone] = useState(false)

  useEffect(() => {
    ensureFonts()
    chrome.storage.local
      .get(CATEGORIES.map((c) => c.key))
      .then((r) => {
        const next: { [k: string]: boolean } = {}
        CATEGORIES.forEach((c) => (next[c.key] = r[c.key] || false))
        setDisabled(next)
      })
  }, [])

  async function toggle(key: string, on: boolean) {
    // `on` = user wants tracking; storage stores the DISABLE flag (inverse).
    await chrome.storage.local.set({ [key]: !on })
    setDisabled((p) => ({ ...p, [key]: !on }))
  }

  async function accept(enable: boolean) {
    await chrome.storage.local.set({ onboarded: true, trackingEnabled: enable })
    setDone(true)
  }

  if (done) {
    return (
      <div className="ob-wrap">
        <style>{OB_CSS}</style>
        <div className="ob-card ob-center">
          <RobotIcon size={64} />
          <h1 className="ob-h1">You're all set.</h1>
          <p className="ob-sub">
            You can change anything any time from the Yukti popup. Close this tab to start.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ob-wrap">
      <style>{OB_CSS}</style>
      <div className="ob-card">
        <div className="ob-brand">
          <RobotIcon size={44} />
          <span className="ob-word">Yukti</span>
        </div>
        <h1 className="ob-h1">Private memory for your browser.</h1>
        <p className="ob-sub">
          Yukti remembers what you browse — entirely on your device — so you can just ask
          about it later. Nothing is recorded until you say so.
        </p>

        <h2 className="ob-h2">What Yukti can remember</h2>
        <div className="ob-list">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="ob-row">
              <div>
                <div className="ob-row-label">{c.label}</div>
                <div className="ob-row-desc">{c.desc}</div>
              </div>
              <label className="ob-toggle">
                <input
                  type="checkbox"
                  checked={!disabled[c.key]}
                  onChange={(e) => toggle(c.key, e.target.checked)}
                />
                <span className="ob-slider" />
              </label>
            </div>
          ))}
        </div>

        <div className="ob-note">
          <SpikeMark size={12} color={color.primary} />
          <span>
            Raw data stays local under a private ID unique to you. Password and payment
            fields are never tracked.
          </span>
        </div>

        <div className="ob-actions">
          <button className="ob-btn ob-btn--primary" onClick={() => accept(true)}>
            Accept &amp; enable
          </button>
          <button className="ob-btn ob-btn--ghost" onClick={() => accept(false)}>
            Stay paused
          </button>
        </div>
      </div>
    </div>
  )
}

const OB_CSS = `
.ob-wrap { min-height: 100vh; display: grid; place-items: center; padding: 40px 20px;
  background: ${color.surface}; font-family: ${font.sans}; color: ${color.body}; }
.ob-wrap * { box-sizing: border-box; }
.ob-card { width: 100%; max-width: 520px; background: ${color.canvas};
  border: 1px solid ${color.hairline}; border-radius: 18px; padding: 32px 30px; }
.ob-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ob-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.ob-word { font-family: ${font.serif}; font-weight: 500; font-size: 30px; letter-spacing: -0.6px; color: ${color.ink}; }
.ob-h1 { font-family: ${font.serif}; font-weight: 400; font-size: 30px; line-height: 1.15;
  letter-spacing: -0.6px; color: ${color.ink}; margin: 0 0 10px; }
.ob-sub { font-size: 14.5px; line-height: 1.55; color: ${color.muted}; margin: 0 0 24px; }
.ob-h2 { font-family: ${font.serif}; font-weight: 500; font-size: 17px; color: ${color.ink}; margin: 0 0 12px; }
.ob-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.ob-row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: ${color.card}; border: 1px solid ${color.hairline}; border-radius: 12px; padding: 13px 15px; }
.ob-row-label { font-size: 14px; font-weight: 600; color: ${color.ink}; }
.ob-row-desc { font-size: 12px; color: ${color.muted}; margin-top: 3px; }
.ob-toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; }
.ob-toggle input { opacity: 0; width: 0; height: 0; }
.ob-slider { position: absolute; inset: 0; cursor: pointer; background: ${color.hairline};
  border-radius: 999px; transition: background 0.18s; }
.ob-slider::before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
  background: ${color.muted}; border-radius: 50%; transition: transform 0.18s, background 0.18s; }
.ob-toggle input:checked + .ob-slider { background: ${color.accentDeep}; }
.ob-toggle input:checked + .ob-slider::before { transform: translateX(18px); background: ${color.onPrimary}; }
.ob-note { display: flex; gap: 9px; align-items: flex-start; background: ${color.card};
  border: 1px solid ${color.hairline}; border-radius: 12px; padding: 13px 14px;
  font-size: 12.5px; line-height: 1.5; color: ${color.body}; margin-bottom: 22px; }
.ob-actions { display: flex; gap: 10px; }
.ob-btn { flex: 1; padding: 13px 16px; border-radius: 10px; cursor: pointer;
  font-family: ${font.sans}; font-size: 14px; font-weight: 600; transition: background 0.15s, border-color 0.15s; }
.ob-btn--primary { background: ${color.primary}; color: ${color.onPrimary}; border: none; }
.ob-btn--primary:hover { background: ${color.primaryDeep}; }
.ob-btn--ghost { background: transparent; color: ${color.body}; border: 1px solid ${color.hairline}; }
.ob-btn--ghost:hover { border-color: ${color.primaryDeep}; color: ${color.ink}; }
`

export default Onboarding
