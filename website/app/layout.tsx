import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yukti - AI-Powered Browser Assistant',
  description: 'Your intelligent browsing companion that learns your patterns and provides actionable suggestions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
