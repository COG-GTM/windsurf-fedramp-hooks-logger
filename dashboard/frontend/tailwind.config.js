/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ws': {
          'bg': '#0a0a0a',
          'sidebar': '#0f0f0f',
          'card': '#141414',
          'card-hover': '#1a1a1a',
          'border': '#1f1f1f',
          'border-light': '#2a2a2a',
          'teal': '#00d4aa',
          'teal-dim': '#00a88a',
          'orange': '#f59e0b',
          'text': '#ffffff',
          'text-secondary': '#a1a1a1',
          'text-muted': '#6b6b6b',
        }
      }
    },
  },
  plugins: [],
}
