/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'devin-dark': '#0a0f1a',
        'devin-darker': '#060a12',
        'devin-card': '#111827',
        'devin-border': '#1e293b',
        'devin-teal': '#14b8a6',
        'devin-teal-light': '#2dd4bf',
        'devin-text': '#e2e8f0',
        'devin-muted': '#94a3b8',
      }
    },
  },
  plugins: [],
}
