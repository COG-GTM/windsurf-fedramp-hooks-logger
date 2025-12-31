/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ws': {
          'bg': 'var(--ws-bg)',
          'sidebar': 'var(--ws-sidebar)',
          'card': 'var(--ws-card)',
          'card-hover': 'var(--ws-card-hover)',
          'border': 'var(--ws-border)',
          'border-light': 'var(--ws-border-light)',
          'teal': 'var(--ws-teal)',
          'teal-dim': 'var(--ws-teal-dim)',
          'orange': 'var(--ws-orange)',
          'text': 'var(--ws-text)',
          'text-secondary': 'var(--ws-text-secondary)',
          'text-muted': 'var(--ws-text-muted)',
        }
      }
    },
  },
  plugins: [],
}
