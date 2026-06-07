'use client'

// ─── Brand mark ─────────────────────────────────────────────────────
const RobotMark = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <rect x="10" y="15" width="80" height="70" rx="12" fill="#17233b" />
    <rect x="12" y="17" width="76" height="66" rx="10" fill="#1e2c48" />
    <rect x="43" y="8" width="14" height="10" rx="2" fill="#34d399" />
    <rect x="45" y="5" width="10" height="5" rx="1" fill="#6ee7b7" />
    <rect x="20" y="28" width="60" height="40" rx="8" fill="#0b1322" />
    <rect x="32" y="42" width="14" height="14" rx="3" fill="#34d399" />
    <rect x="50" y="44" width="10" height="10" rx="2" fill="#a7f3d0" opacity="0.85" />
    <rect x="32" y="42" width="14" height="14" rx="3" fill="#34d399" opacity="0.001" />
    <rect x="54" y="42" width="14" height="14" rx="3" fill="#34d399" />
    <rect x="56" y="44" width="10" height="10" rx="2" fill="#a7f3d0" opacity="0.85" />
    <rect x="38" y="75" width="24" height="4" rx="2" fill="#06b6d4" />
    <rect x="40" y="76" width="20" height="2" rx="1" fill="#67e8f9" opacity="0.6" />
  </svg>
)

const Spike = ({ size = 12, color = '#34d399' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="inline-block shrink-0 align-middle" aria-hidden="true">
    <path d="M12 2 L13.4 9.2 L20.5 6.2 L14.8 11.2 L22 12 L14.8 12.8 L20.5 17.8 L13.4 14.8 L12 22 L10.6 14.8 L3.5 17.8 L9.2 12.8 L2 12 L9.2 11.2 L3.5 6.2 L10.6 9.2 Z" fill={color} />
  </svg>
)

const ArrowDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
)

// ─── Feature icons — cyan/green duotone line art ────────────────────
const stroke = { fill: 'none' as const, stroke: '#34d399', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const IconRecall = () => (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /><path d="M12 8v4l3 2" /></svg>)
const IconPage = () => (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>)
const IconLock = () => (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>)
const IconSwap = () => (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>)
const IconQuote = () => (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><path d="M4 6h16M4 12h10M4 18h13" /><circle cx="19" cy="18" r="2" /></svg>)
const IconGlobe = () => (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" /></svg>)

const FEATURES = [
  { Icon: IconRecall, title: 'Recall anything', body: 'Ask about a page you read this morning or a search you ran last week. Yukti retrieves it semantically.' },
  { Icon: IconPage, title: 'Page-aware', body: 'It reads the page you’re on live, so “what’s this about?” works on the spot — no indexing wait.' },
  { Icon: IconLock, title: 'Private by design', body: 'Every interaction is scoped to a private ID that’s only yours. Passwords and payment fields are never tracked.' },
  { Icon: IconSwap, title: 'Bring your own model', body: 'Gemini, OpenAI, Groq or Mistral — switch the provider with one config line. No lock-in.' },
  { Icon: IconQuote, title: 'Source-cited', body: 'Answers come with the interactions that backed them, so you can trust where each one came from.' },
  { Icon: IconGlobe, title: 'Lives everywhere', body: 'A quiet floating companion on every tab. Click once to ask; click away to dismiss.' },
]

const STEPS = [
  { n: '01', title: 'Capture', body: 'As you browse, Yukti notes the meaningful moments — pages, searches, clicks — in the background.' },
  { n: '02', title: 'Index', body: 'Those moments are turned into a private, searchable memory in your own vector store.' },
  { n: '03', title: 'Ask', body: 'Open the chat and ask in plain language. Yukti blends your history with the live page to answer.' },
]

const PROVIDERS = ['Gemini', 'OpenAI', 'Groq', 'Mistral']

export default function Home() {
  const handleDownload = () => {
    window.location.href = '/yukti-extension.zip'
  }

  return (
    <main className="min-h-screen bg-canvas text-body font-sans">
      {/* ─── Nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/85 backdrop-blur">
        <div className="max-w-content mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <RobotMark size={28} />
            <span className="font-serif text-[22px] font-medium tracking-[-0.4px] text-ink">Yukti</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-ink transition-colors">Features</a>
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#install" className="hover:text-ink transition-colors">Install</a>
          </div>
          <button onClick={handleDownload} className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-on-primary hover:bg-cyan-deep transition-colors">
            Get Yukti
          </button>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-glow" />
        <div className="relative max-w-content mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
          {/* Left */}
          <div>
            <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1 text-xs font-medium text-muted">
              <Spike size={12} color="#22d3ee" />
              Browser assistant · RAG-powered
            </div>
            <h1 className="animate-rise delay-1 mt-6 font-serif font-normal text-ink text-[clamp(40px,6vw,64px)] leading-[1.05] tracking-[-1.5px]">
              Your browsing,<br /><em className="italic text-cyan">remembered.</em>
            </h1>
            <p className="animate-rise delay-2 mt-6 max-w-md text-[17px] leading-relaxed text-body">
              Yukti quietly indexes what you do, then answers questions about the page you&rsquo;re on
              and everything you&rsquo;ve browsed — in plain language.
            </p>
            <div className="animate-rise delay-3 mt-9 flex flex-wrap items-center gap-3">
              <button onClick={handleDownload} className="rounded-lg bg-cyan px-6 py-3.5 text-sm font-semibold text-on-primary hover:bg-cyan-deep transition-colors inline-flex items-center gap-2">
                <ArrowDown /> Download extension
              </button>
              <a href="#how" className="rounded-lg border border-hairline bg-card px-6 py-3.5 text-sm font-semibold text-body-strong hover:border-cyan-deep transition-colors">
                See how it works
              </a>
            </div>
            <p className="animate-rise delay-4 mt-6 text-xs text-muted-soft flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse-glow" />
              Free · Chrome (Manifest V3) · Your data stays scoped to you
            </p>
          </div>

          {/* Right — product mockup */}
          <div className="animate-rise delay-2 animate-float">
            <ChatMock />
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────── */}
      <section id="features" className="border-t border-hairline-soft bg-surface">
        <div className="max-w-content mx-auto px-6 py-24">
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-cyan-deep">Features</p>
          <h2 className="mt-3 font-serif font-normal text-ink text-[clamp(30px,4vw,44px)] leading-[1.1] tracking-[-0.8px] max-w-xl">
            Built to remember, designed to ask.
          </h2>
          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-hairline bg-card p-7 hover:border-hairline transition-colors">
                <div className="w-11 h-11 rounded-lg bg-canvas border border-hairline grid place-items-center">
                  <Icon />
                </div>
                <h3 className="mt-5 font-serif text-xl font-medium text-ink tracking-[-0.3px]">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-body">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────── */}
      <section id="how" className="border-t border-hairline-soft bg-canvas">
        <div className="max-w-content mx-auto px-6 py-24">
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-cyan-deep">How it works</p>
          <h2 className="mt-3 font-serif font-normal text-ink text-[clamp(30px,4vw,44px)] leading-[1.1] tracking-[-0.8px] max-w-xl">
            Three steps, always on.
          </h2>
          <div className="mt-14 grid md:grid-cols-3 gap-px bg-hairline-soft rounded-xl overflow-hidden border border-hairline-soft">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-surface p-8">
                <div className="font-serif text-5xl font-medium text-cyan tracking-[-2px]">{s.n}</div>
                <h3 className="mt-5 font-serif text-2xl font-medium text-ink tracking-[-0.3px]">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-body">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Coral-callout equivalent: cyan band ─────────────── */}
      <section className="bg-canvas px-6 pb-24">
        <div className="max-w-content mx-auto rounded-2xl bg-cyan px-8 md:px-14 py-14 overflow-hidden relative">
          <div className="relative">
            <h2 className="font-serif font-normal text-on-primary text-[clamp(28px,4vw,40px)] leading-[1.1] tracking-[-0.6px] max-w-lg">
              Bring your own model.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#0a3a47]">
              No vendor lock-in. Point Yukti at whichever provider you trust and switch any time with a single line of config.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {PROVIDERS.map((p) => (
                <span key={p} className="rounded-full bg-[#0b1322]/15 border border-[#0a3a47]/30 px-4 py-1.5 text-sm font-semibold text-[#06222b]">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Install ─────────────────────────────────────────── */}
      <section id="install" className="border-t border-hairline-soft bg-surface">
        <div className="max-w-content mx-auto px-6 py-24 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-cyan-deep">Install</p>
            <h2 className="mt-3 font-serif font-normal text-ink text-[clamp(30px,4vw,44px)] leading-[1.1] tracking-[-0.8px]">
              Up and running in a minute.
            </h2>
            <ol className="mt-8 space-y-5">
              {[
                ['Download', 'Grab the extension package below.'],
                ['Unzip', 'Extract the archive anywhere on your machine.'],
                ['Load unpacked', 'In chrome://extensions, enable Developer mode and load the chrome-mv3-prod folder.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-md bg-card border border-hairline grid place-items-center font-serif text-cyan text-sm font-medium">{i + 1}</span>
                  <div>
                    <div className="font-semibold text-ink text-[15px]">{t}</div>
                    <div className="text-sm text-muted mt-0.5">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
            <button onClick={handleDownload} className="mt-9 rounded-lg bg-cyan px-6 py-3.5 text-sm font-semibold text-on-primary hover:bg-cyan-deep transition-colors inline-flex items-center gap-2">
              <ArrowDown /> Download yukti-extension.zip
            </button>
          </div>

          {/* Code window card */}
          <div className="rounded-xl border border-hairline bg-canvas overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-hairline-soft">
              <span className="w-3 h-3 rounded-full bg-[#3a2630]" />
              <span className="w-3 h-3 rounded-full bg-[#3a3326]" />
              <span className="w-3 h-3 rounded-full bg-[#26352f]" />
              <span className="ml-2 text-xs text-muted-soft font-mono">chrome://extensions</span>
            </div>
            <pre className="p-5 text-[13px] leading-relaxed font-mono text-body overflow-x-auto">
<span className="text-muted-soft"># enable Developer mode → Load unpacked</span>{'\n'}
<span className="text-muted-soft"># select the extracted chrome-mv3-prod folder</span>{'\n\n'}
<span className="text-muted-soft"># click the Yukti icon and start asking</span>
            </pre>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-hairline-soft bg-canvas">
        <div className="max-w-content mx-auto px-6 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <Spike size={16} color="#22d3ee" />
              <span className="font-serif text-xl font-medium text-ink tracking-[-0.3px]">Yukti</span>
            </div>
            <p className="mt-3 text-sm text-muted max-w-xs">Your browsing, remembered. A privacy-minded browser assistant.</p>
          </div>
          <div className="flex gap-12 text-sm">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-[1px] text-muted-soft">Product</div>
              <a href="#features" className="block text-body hover:text-ink transition-colors">Features</a>
              <a href="#how" className="block text-body hover:text-ink transition-colors">How it works</a>
              <a href="#install" className="block text-body hover:text-ink transition-colors">Install</a>
            </div>
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-[1px] text-muted-soft">Project</div>
              <a href="https://github.com/shivvamm/Yukti" className="block text-body hover:text-ink transition-colors">GitHub</a>
              <a href="mailto:support@yukti.ai" className="block text-body hover:text-ink transition-colors">Support</a>
            </div>
          </div>
        </div>
        <div className="border-t border-hairline-soft">
          <div className="max-w-content mx-auto px-6 py-6 text-xs text-muted-soft">
            © {new Date().getFullYear()} Yukti · Built with Next.js, FastAPI, LangChain & Pinecone
          </div>
        </div>
      </footer>
    </main>
  )
}

// ─── Hero product mockup (recreates the real chat panel) ────────────
function ChatMock() {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-2xl border border-hairline bg-canvas overflow-hidden shadow-[0_30px_70px_-20px_rgba(2,6,16,0.8)]">
      {/* header */}
      <div className="relative flex items-center justify-between px-4 py-3.5 border-b border-hairline-soft">
        <div className="absolute inset-x-0 top-0 h-24 bg-glow pointer-events-none" />
        <div className="relative flex items-center gap-2.5">
          <RobotMark size={28} />
          <span className="font-serif text-[20px] font-medium text-ink tracking-[-0.4px]">Yukti</span>
        </div>
        <span className="relative flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green" />online
        </span>
      </div>
      {/* messages */}
      <div className="bg-surface px-4 py-5 space-y-3.5">
        <div className="flex justify-end">
          <div className="max-w-[82%] rounded-xl rounded-tr-[4px] border border-hairline bg-elevated px-3.5 py-2.5 text-[13.5px] text-ink">
            what was that startup I looked at yesterday?
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="shrink-0 w-7 h-7 rounded-lg border border-hairline bg-canvas grid place-items-center">
            <RobotMark size={18} />
          </div>
          <div className="max-w-[82%] rounded-xl rounded-tl-[4px] border border-hairline bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-body-strong">
            You were on <span className="text-ink font-semibold">workatastartup.com</span> on Jun 7,
            viewing <span className="text-ink font-semibold">&ldquo;AI Engineer&rdquo;</span> roles.
            <div className="mt-2.5 pt-2.5 border-t border-dashed border-hairline-soft flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted">
              <Spike size={11} /> 3 sources ▸
            </div>
          </div>
        </div>
      </div>
      {/* composer */}
      <div className="flex items-end gap-2.5 px-3.5 py-3.5 bg-canvas border-t border-hairline-soft">
        <div className="flex-1 rounded-lg border border-hairline bg-elevated px-3.5 py-2.5 text-[13.5px] text-muted-soft">Ask anything…</div>
        <div className="w-10 h-10 shrink-0 rounded-lg bg-cyan grid place-items-center text-on-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
        </div>
      </div>
    </div>
  )
}
