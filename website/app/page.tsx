'use client'

import { useState } from 'react'

// ─── Icon components ────────────────────────────────────────────────
// Inline SVGs to keep the bundle small and the pixel-art aesthetic
// consistent with the hero robot. Each is 48×48 with chunky strokes.

const IconBrain = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="square">
    <circle cx="24" cy="24" r="6" />
    <circle cx="12" cy="12" r="3" />
    <circle cx="36" cy="12" r="3" />
    <circle cx="12" cy="36" r="3" />
    <circle cx="36" cy="36" r="3" />
    <line x1="15" y1="15" x2="20" y2="20" />
    <line x1="33" y1="15" x2="28" y2="20" />
    <line x1="15" y1="33" x2="20" y2="28" />
    <line x1="33" y1="33" x2="28" y2="28" />
  </svg>
)

const IconTarget = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="3">
    <circle cx="24" cy="24" r="18" />
    <circle cx="24" cy="24" r="11" />
    <circle cx="24" cy="24" r="4" fill="#10b981" />
  </svg>
)

const IconBulb = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M16 22 Q16 12 24 12 Q32 12 32 22 Q32 28 28 32 L20 32 Q16 28 16 22 Z" />
    <line x1="20" y1="36" x2="28" y2="36" />
    <line x1="22" y1="40" x2="26" y2="40" />
  </svg>
)

const IconLock = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
    <rect x="12" y="22" width="24" height="18" />
    <path d="M17 22 V16 Q17 10 24 10 Q31 10 31 16 V22" />
    <circle cx="24" cy="30" r="2" fill="#10b981" />
  </svg>
)

const IconBolt = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="3" strokeLinejoin="miter">
    <path d="M26 6 L14 26 L22 26 L22 42 L34 22 L26 22 Z" fill="#10b981" fillOpacity="0.25" />
  </svg>
)

const IconWindow = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
    <rect x="8" y="10" width="32" height="22" />
    <line x1="8" y1="18" x2="40" y2="18" />
    <circle cx="12" cy="14" r="1.5" fill="#10b981" />
    <circle cx="16" cy="14" r="1.5" fill="#10b981" />
    <circle cx="20" cy="14" r="1.5" fill="#10b981" />
    <path d="M18 25 L24 25 L21 28 Z" fill="#10b981" />
  </svg>
)

const IconDownload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" className="inline-block mr-2 -mt-1 align-middle">
    <path d="M12 4 V15" />
    <path d="M6 11 L12 17 L18 11" />
    <path d="M4 20 H20" />
  </svg>
)

const IconHeart = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none" className="inline-block -mt-1 mx-1 align-middle">
    <path d="M12 21 L3 12 Q3 7 7 7 Q10 7 12 10 Q14 7 17 7 Q21 7 21 12 Z" />
  </svg>
)

export default function Home() {
  const [_copied, _setCopied] = useState(false)

  const handleDownload = () => {
    window.location.href = '/yukti-extension.zip'
  }

  return (
    <main className="min-h-screen bg-pixel-dark">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b-4 border-pixel-slate">
        <div className="absolute inset-0 bg-gradient-to-b from-pixel-blue/50 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          {/* Robot Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <svg width="120" height="120" viewBox="0 0 100 100" className="animate-float">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Robot body */}
                <rect x="25" y="30" width="50" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" strokeWidth="3"/>

                {/* Eyes */}
                <rect x="32" y="42" width="14" height="14" rx="3" fill="#10b981" filter="url(#glow)" className="animate-pulse-glow" />
                <rect x="54" y="42" width="14" height="14" rx="3" fill="#10b981" filter="url(#glow)" className="animate-pulse-glow" />

                {/* Smile */}
                <path d="M 35 65 Q 50 72 65 65" stroke="#06b6d4" strokeWidth="3" fill="none" strokeLinecap="round"/>

                {/* Antenna */}
                <line x1="50" y1="30" x2="50" y2="20" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="50" cy="18" r="4" fill="#10b981" className="animate-pulse-glow"/>
              </svg>
            </div>
          </div>

          <h1 className="text-6xl font-bold mb-6 text-pixel-cyan tracking-wider">
            YUKTI
          </h1>

          <p className="text-2xl mb-8 text-gray-300">
            Your AI-Powered Browser Assistant
          </p>

          <p className="text-lg mb-12 text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Yukti learns from your browsing patterns and provides intelligent,
            actionable suggestions to help you browse smarter and faster.
          </p>

          <button
            onClick={handleDownload}
            className="group relative px-8 py-4 bg-pixel-cyan text-pixel-dark font-bold text-lg
                     border-4 border-cyan-600 hover:bg-cyan-400 transition-all
                     shadow-[0_6px_0_#0891b2] hover:shadow-[0_4px_0_#0891b2]
                     hover:translate-y-[2px] active:translate-y-[6px] active:shadow-none"
          >
            <IconDownload />DOWNLOAD EXTENSION
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-16 text-pixel-green tracking-wider">
          FEATURES
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              Icon: IconBrain,
              title: 'SMART LEARNING',
              description: 'Analyzes ALL your browsing interactions to understand your real intent and goals'
            },
            {
              Icon: IconTarget,
              title: 'INTENT ANALYSIS',
              description: 'Deep psychological analysis to detect what you\'re actually trying to accomplish'
            },
            {
              Icon: IconBulb,
              title: 'ACTIONABLE HELP',
              description: 'Provides ONE powerful suggestion that directly helps you succeed'
            },
            {
              Icon: IconLock,
              title: 'PRIVACY FIRST',
              description: 'All data stored locally. Full control over what gets tracked'
            },
            {
              Icon: IconBolt,
              title: 'MULTI-LLM',
              description: 'Plug-in support for Gemini, OpenAI, Groq, and Mistral — switch providers via config'
            },
            {
              Icon: IconWindow,
              title: 'NON-INTRUSIVE',
              description: 'Auto-popup suggestions that hide after 5 seconds. No clutter'
            }
          ].map(({ Icon, title, description }, i) => (
            <div
              key={i}
              className="bg-pixel-blue border-2 border-pixel-slate p-6
                       hover:border-pixel-cyan transition-all group"
            >
              <div className="mb-4"><Icon /></div>
              <h3 className="text-xl font-bold mb-3 text-pixel-cyan tracking-wide">
                {title}
              </h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-pixel-blue border-y-4 border-pixel-slate py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 text-pixel-green tracking-wider">
            HOW IT WORKS
          </h2>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'CONTEXT BUILDER',
                description: 'Extracts rich session context from ALL your interactions - searches, clicks, form inputs, page visits'
              },
              {
                step: '02',
                title: 'INTENT ANALYZER',
                description: 'Deep psychological analysis to understand your REAL goals, not just surface patterns'
              },
              {
                step: '03',
                title: 'SUGGESTION ENGINE',
                description: 'Generates ONE powerful, actionable suggestion based on your current page and intent'
              }
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-16 h-16 bg-pixel-cyan text-pixel-dark
                              font-bold text-2xl flex items-center justify-center
                              border-4 border-cyan-600">
                  {step.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2 text-pixel-cyan tracking-wide">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Installation Instructions */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-16 text-pixel-green tracking-wider">
          INSTALLATION
        </h2>

        <div className="bg-pixel-blue border-2 border-pixel-slate p-8 mb-8">
          <h3 className="text-2xl font-bold mb-6 text-pixel-cyan tracking-wide">
            STEP 1: DOWNLOAD
          </h3>
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-pixel-green text-pixel-dark font-bold
                     border-3 border-green-700 hover:bg-green-400 transition-all
                     shadow-[0_4px_0_#059669] hover:shadow-[0_2px_0_#059669]
                     hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none"
          >
            <IconDownload />DOWNLOAD YUKTI.ZIP
          </button>
        </div>

        <div className="bg-pixel-blue border-2 border-pixel-slate p-8 mb-8">
          <h3 className="text-2xl font-bold mb-6 text-pixel-cyan tracking-wide">
            STEP 2: EXTRACT
          </h3>
          <p className="text-gray-400 mb-4">
            Extract the downloaded ZIP file to a folder on your computer
          </p>
          <div className="bg-pixel-dark border-2 border-pixel-slate p-4 font-mono text-sm text-pixel-cyan">
            $ unzip yukti-extension.zip
          </div>
        </div>

        <div className="bg-pixel-blue border-2 border-pixel-slate p-8">
          <h3 className="text-2xl font-bold mb-6 text-pixel-cyan tracking-wide">
            STEP 3: LOAD IN CHROME
          </h3>
          <ol className="space-y-4 text-gray-400">
            <li className="flex gap-3">
              <span className="text-pixel-cyan font-bold">1.</span>
              <span>Open Chrome and go to <code className="text-pixel-green">chrome://extensions/</code></span>
            </li>
            <li className="flex gap-3">
              <span className="text-pixel-cyan font-bold">2.</span>
              <span>Enable <strong className="text-pixel-cyan">Developer mode</strong> (toggle in top right)</span>
            </li>
            <li className="flex gap-3">
              <span className="text-pixel-cyan font-bold">3.</span>
              <span>Click <strong className="text-pixel-cyan">Load unpacked</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="text-pixel-cyan font-bold">4.</span>
              <span>Select the <strong className="text-pixel-green">chrome-mv3-prod</strong> folder from the extracted files</span>
            </li>
            <li className="flex gap-3">
              <span className="text-pixel-cyan font-bold">5.</span>
              <span>Yukti is now installed.</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-pixel-slate py-8 text-center text-gray-500">
        <p className="mb-2">YUKTI - AI-POWERED BROWSER ASSISTANT</p>
        <p className="text-sm">Built with<IconHeart />using Next.js, React, and LangGraph</p>
        <div className="mt-4 space-x-4">
          <a href="https://github.com/shivvamm/Yukti" className="text-pixel-cyan hover:text-pixel-green">
            GITHUB
          </a>
          <span className="text-pixel-slate">|</span>
          <a href="mailto:support@yukti.ai" className="text-pixel-cyan hover:text-pixel-green">
            SUPPORT
          </a>
        </div>
      </footer>
    </main>
  )
}
