/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Yukti "editorial product chrome" tokens — shared with the extension.
        canvas: '#0b1322',
        surface: '#101b2e',
        card: '#17233b',
        elevated: '#1e2c48',
        hairline: '#28344c',
        'hairline-soft': '#1c2740',
        cyan: '#22d3ee',
        'cyan-deep': '#06b6d4',
        green: '#34d399',
        'green-deep': '#10b981',
        ink: '#f2f6fc',
        'body-strong': '#d7e1f0',
        body: '#a6b3c8',
        muted: '#7c8aa3',
        'muted-soft': '#5a6884',
        'on-primary': '#04131c',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      maxWidth: {
        content: '1120px',
      },
    },
  },
  plugins: [],
}
