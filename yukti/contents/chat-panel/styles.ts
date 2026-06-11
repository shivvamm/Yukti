import { color, font, radius } from "~theme"

// One scoped stylesheet for the whole chat panel. Rendered as a <style> tag
// inside the Plasmo shadow root (see ChatPanel), so it can't leak onto the
// host page and the host page can't leak in. Class-based styling buys us
// hover/focus states, a custom scrollbar, markdown typography, and entrance
// animations — none of which inline styles can express.
export const PANEL_CSS = `
.yk-root {
  font-family: ${font.sans};
  color: ${color.body};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.yk-root *,
.yk-root *::before,
.yk-root *::after { box-sizing: border-box; }

/* ── Panel shell ─────────────────────────────────────────────── */
.yk-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 384px;
  height: 600px;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background: ${color.canvas};
  border: 1px solid ${color.hairline};
  border-radius: ${radius.xl}px;
  overflow: hidden;
  z-index: 2147483647;
  box-shadow: 0 24px 60px -12px rgba(2, 6, 16, 0.7), 0 0 0 1px rgba(34, 211, 238, 0.04);
  animation: yk-rise 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes yk-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Header ──────────────────────────────────────────────────── */
.yk-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: ${color.canvas};
  border-bottom: 1px solid ${color.hairlineSoft};
}
/* faint cyan atmosphere bleeding down from the top edge */
.yk-header::after {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 120px;
  pointer-events: none;
  background: radial-gradient(120% 80% at 18% 0%, rgba(34, 211, 238, 0.10), transparent 70%);
}
.yk-brand { display: flex; align-items: center; gap: 10px; position: relative; }
.yk-wordmark {
  font-family: ${font.serif};
  font-weight: 500;
  font-size: 21px;
  letter-spacing: -0.4px;
  color: ${color.ink};
  line-height: 1;
}
.yk-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: ${color.muted};
  position: relative;
}
.yk-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: ${color.accent};
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.14);
}
.yk-close {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: ${radius.md}px;
  border: 1px solid transparent;
  background: transparent;
  color: ${color.muted};
  cursor: pointer;
  font-size: 17px; line-height: 1;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.yk-close:hover { background: ${color.elevated}; color: ${color.ink}; border-color: ${color.hairline}; }

/* header quick actions (Summarize / New) */
.yk-action {
  height: 28px;
  padding: 0 10px;
  border-radius: ${radius.md}px;
  border: 1px solid ${color.hairline};
  background: ${color.elevated};
  color: ${color.body};
  font-family: ${font.sans};
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.yk-action:hover:not(:disabled) { color: ${color.ink}; border-color: ${color.primaryDeep}; }
.yk-action:disabled { opacity: 0.5; cursor: not-allowed; }

/* per-message actions (Copy / Regenerate) */
.yk-msg-actions { display: flex; gap: 6px; margin-top: 9px; }
.yk-msg-action {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: ${font.sans};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: ${color.muted};
  transition: color 0.15s;
}
.yk-msg-action:hover { color: ${color.accent}; }

/* ── Message list ────────────────────────────────────────────── */
.yk-list {
  flex: 1;
  overflow-y: auto;
  padding: 18px 16px 8px;
  background: ${color.surface};
  scroll-behavior: smooth;
}
.yk-list::-webkit-scrollbar { width: 10px; }
.yk-list::-webkit-scrollbar-track { background: transparent; }
.yk-list::-webkit-scrollbar-thumb {
  background: ${color.hairline};
  border-radius: 99px;
  border: 3px solid ${color.surface};
}
.yk-list::-webkit-scrollbar-thumb:hover { background: ${color.elevated}; }

/* ── Empty / hero state ──────────────────────────────────────── */
.yk-hero {
  height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 24px 20px;
  gap: 4px;
}
.yk-hero-title {
  font-family: ${font.serif};
  font-weight: 400;
  font-size: 26px;
  line-height: 1.18;
  letter-spacing: -0.5px;
  color: ${color.ink};
  margin: 14px 0 0;
  max-width: 280px;
}
.yk-hero-sub {
  font-size: 13px;
  line-height: 1.5;
  color: ${color.muted};
  margin: 8px 0 20px;
  max-width: 260px;
}
.yk-chips { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 290px; }
.yk-chip {
  text-align: left;
  padding: 11px 14px;
  background: ${color.card};
  border: 1px solid ${color.hairline};
  border-radius: ${radius.lg}px;
  color: ${color.bodyStrong};
  font-family: ${font.sans};
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.16s, transform 0.16s, background 0.16s;
}
.yk-chip:hover {
  border-color: ${color.primaryDeep};
  background: ${color.elevated};
  transform: translateX(2px);
}
.yk-chip-arrow { color: ${color.primary}; float: right; opacity: 0.7; }

/* ── Message rows + bubbles ──────────────────────────────────── */
.yk-row { display: flex; gap: 9px; margin-bottom: 14px; align-items: flex-start; }
.yk-row.user { justify-content: flex-end; }
.yk-avatar {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border-radius: ${radius.md}px;
  display: grid; place-items: center;
  margin-top: 1px;
}
.yk-bubble {
  max-width: 82%;
  padding: 10px 13px;
  font-size: 13.5px;
  line-height: 1.5;
  border-radius: ${radius.lg}px;
  word-break: break-word;
}
.yk-bubble.assistant {
  background: ${color.card};
  border: 1px solid ${color.hairline};
  color: ${color.bodyStrong};
  border-top-left-radius: 4px;
}
.yk-bubble.user {
  background: ${color.elevated};
  border: 1px solid ${color.hairline};
  color: ${color.ink};
  border-top-right-radius: 4px;
  white-space: pre-wrap;
}
.yk-bubble.error {
  background: ${color.errorSurface};
  border: 1px solid ${color.errorBorder};
  color: ${color.error};
  border-top-left-radius: 4px;
}

/* ── Markdown typography inside assistant bubbles ───────────────── */
.yk-md > :first-child { margin-top: 0; }
.yk-md > :last-child { margin-bottom: 0; }
.yk-md p { margin: 7px 0; line-height: 1.55; }
.yk-md h1, .yk-md h2, .yk-md h3 {
  font-family: ${font.serif};
  font-weight: 500;
  letter-spacing: -0.3px;
  color: ${color.ink};
  margin: 14px 0 6px;
  line-height: 1.2;
}
.yk-md h1 { font-size: 18px; }
.yk-md h2 { font-size: 16px; }
.yk-md h3 { font-size: 15px; }
.yk-md h4, .yk-md h5, .yk-md h6 {
  font-weight: 600; font-size: 13.5px; color: ${color.accent}; margin: 12px 0 4px;
}
.yk-md strong { color: ${color.ink}; font-weight: 600; }
.yk-md em { font-style: italic; }
.yk-md a { color: ${color.accent}; text-decoration: none; border-bottom: 1px solid rgba(52,211,153,0.4); }
.yk-md a:hover { border-bottom-color: ${color.accent}; }
.yk-md ul, .yk-md ol { margin: 7px 0; padding-left: 20px; }
.yk-md li { margin: 4px 0; line-height: 1.5; }
.yk-md li::marker { color: ${color.primaryDeep}; }
.yk-md code {
  font-family: ${font.mono};
  font-size: 12px;
  background: ${color.canvas};
  color: #7dd3fc;
  padding: 1px 6px;
  border-radius: ${radius.sm}px;
  border: 1px solid ${color.hairlineSoft};
}
.yk-md pre {
  background: ${color.canvas};
  border: 1px solid ${color.hairline};
  border-radius: ${radius.md}px;
  padding: 11px 13px;
  overflow-x: auto;
  margin: 9px 0;
}
.yk-md pre code { background: none; border: none; padding: 0; color: ${color.bodyStrong}; }
.yk-md blockquote {
  border-left: 2px solid ${color.primaryDeep};
  padding-left: 11px; margin: 9px 0; color: ${color.muted};
}
.yk-md hr { border: none; border-top: 1px solid ${color.hairline}; margin: 12px 0; }
.yk-md table { border-collapse: collapse; margin: 9px 0; font-size: 12.5px; width: 100%; }
.yk-md th, .yk-md td { border: 1px solid ${color.hairline}; padding: 5px 9px; text-align: left; }
.yk-md th { background: ${color.canvas}; color: ${color.ink}; }

/* ── Sources ─────────────────────────────────────────────────── */
.yk-src { margin-top: 10px; padding-top: 9px; border-top: 1px dashed ${color.hairlineSoft}; }
.yk-src-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: none; cursor: pointer; padding: 0;
  font-family: ${font.sans};
  font-size: 11px; font-weight: 600; letter-spacing: 0.4px;
  color: ${color.muted}; text-transform: uppercase;
  transition: color 0.15s;
}
.yk-src-toggle:hover { color: ${color.accent}; }
.yk-src-list { list-style: none; padding: 8px 0 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }
.yk-src-item {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 11.5px; line-height: 1.4;
}
.yk-src-host { color: ${color.accent}; text-decoration: none; font-weight: 600; flex-shrink: 0; }
.yk-src-host:hover { text-decoration: underline; }
.yk-src-snip { color: ${color.mutedSoft}; }

/* ── Thinking indicator ──────────────────────────────────────── */
.yk-think { display: flex; align-items: center; gap: 9px; padding: 4px 2px 12px 35px; }
.yk-think-dots { display: inline-flex; gap: 4px; }
.yk-think-dots i {
  width: 6px; height: 6px; border-radius: 50%; background: ${color.primary};
  animation: yk-blink 1.2s infinite ease-in-out both;
}
.yk-think-dots i:nth-child(2) { animation-delay: 0.18s; }
.yk-think-dots i:nth-child(3) { animation-delay: 0.36s; }
.yk-think-label { font-size: 12px; color: ${color.muted}; font-style: italic; font-family: ${font.serif}; }
@keyframes yk-blink {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

/* ── Composer ────────────────────────────────────────────────── */
.yk-composer {
  display: flex; gap: 9px; align-items: flex-end;
  padding: 12px 14px 14px;
  background: ${color.canvas};
  border-top: 1px solid ${color.hairlineSoft};
}
.yk-input {
  flex: 1;
  padding: 10px 13px;
  background: ${color.elevated};
  color: ${color.ink};
  border: 1px solid ${color.hairline};
  border-radius: ${radius.md}px;
  font-family: ${font.sans};
  font-size: 13.5px;
  line-height: 1.45;
  resize: none;
  outline: none;
  transition: border-color 0.16s, box-shadow 0.16s;
  max-height: 120px;
}
.yk-input::placeholder { color: ${color.mutedSoft}; }
.yk-input:focus {
  border-color: ${color.primaryDeep};
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.16);
}
.yk-input:disabled { opacity: 0.6; cursor: not-allowed; }
.yk-send {
  flex-shrink: 0;
  width: 40px; height: 40px;
  display: grid; place-items: center;
  border-radius: ${radius.md}px;
  border: none;
  background: ${color.primary};
  color: ${color.onPrimary};
  cursor: pointer;
  transition: background 0.16s, transform 0.1s;
}
.yk-send:hover:not(:disabled) { background: ${color.primaryDeep}; }
.yk-send:active:not(:disabled) { transform: translateY(1px); }
.yk-send:disabled { background: ${color.primaryDisabled}; color: ${color.mutedSoft}; cursor: not-allowed; }
.yk-send svg { width: 18px; height: 18px; }
`
