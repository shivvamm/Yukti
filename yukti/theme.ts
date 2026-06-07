// Yukti design tokens — "editorial product chrome in dark navy".
//
// Translates the Claude.com editorial design system into Yukti's cool
// trinity: a deep-navy surface ladder, a SCARCE cyan accent (the "coral"
// equivalent — used only on the primary CTA, the wordmark, focus rings),
// and a green companion (the "teal" — status dots, source links). A
// Fraunces serif carries the literary display voice; Hanken Grotesk
// handles humanist body/UI. Shared by the popup and the content-script
// chat panel.

export const color = {
  // Surface ladder, deepest → most elevated. The cream→dark "pacing
  // rhythm" of the Claude system, rendered as 4 cool-navy steps.
  canvas: "#0b1322", // deepest floor: header, input bar
  surface: "#101b2e", // message area band
  card: "#17233b", // cards, assistant bubble
  elevated: "#1e2c48", // input field, user bubble, raised chips

  // Hairlines — borders feel like one elevation step, never ink lines.
  hairline: "#28344c",
  hairlineSoft: "#1c2740",

  // Accent trinity — cyan is scarce, green is the companion.
  primary: "#22d3ee",
  primaryDeep: "#06b6d4",
  primaryActive: "#0e7490",
  primaryDisabled: "#2a3a4f",
  accent: "#34d399",
  accentDeep: "#10b981",

  // Text on dark — cool whites cascading down to muted captions.
  ink: "#f2f6fc",
  bodyStrong: "#d7e1f0",
  body: "#a6b3c8",
  muted: "#7c8aa3",
  mutedSoft: "#5a6884",

  // On-accent + semantic
  onPrimary: "#04131c",
  error: "#f87171",
  errorSurface: "#2a1622",
  errorBorder: "#5b2533",
  success: "#34d399",
}

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
}

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
}

export const font = {
  // Display serif → the editorial voice. Falls back to Georgia so the
  // literary feel survives even when Google Fonts is blocked by a host
  // page's CSP.
  serif: `'Fraunces','Newsreader',Georgia,'Times New Roman',serif`,
  // Humanist body sans — never geometric, never Inter-generic.
  sans: `'Hanken Grotesk','Mona Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`,
  mono: `'JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace`,
}

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  "family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&" +
  "family=Hanken+Grotesk:wght@400;500;600;700&" +
  "family=JetBrains+Mono:wght@400;500&display=swap"

// Inject the webfont stylesheet into a document head exactly once. Safe to
// call from both the popup (its own document) and a content script (the
// host page's document — fonts defined there are reachable inside the
// Plasmo shadow root). Best-effort: strict host CSPs may block it, in
// which case the serif/sans fallback stacks keep the design intact.
export function ensureFonts(doc: Document = document): void {
  if (!doc || doc.getElementById("yukti-fonts")) return
  const pre1 = doc.createElement("link")
  pre1.rel = "preconnect"
  pre1.href = "https://fonts.googleapis.com"
  const pre2 = doc.createElement("link")
  pre2.rel = "preconnect"
  pre2.href = "https://fonts.gstatic.com"
  pre2.crossOrigin = "anonymous"
  const sheet = doc.createElement("link")
  sheet.id = "yukti-fonts"
  sheet.rel = "stylesheet"
  sheet.href = FONTS_HREF
  doc.head.appendChild(pre1)
  doc.head.appendChild(pre2)
  doc.head.appendChild(sheet)
}
