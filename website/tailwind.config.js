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
        'pixel-dark': '#0f172a',
        'pixel-blue': '#1e293b',
        'pixel-slate': '#334155',
        'pixel-cyan': '#06b6d4',
        'pixel-green': '#10b981',
      },
      fontFamily: {
        'mono': ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
