module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)', foreground: 'var(--foreground)',
        surface: 'var(--surface)', elevated: 'var(--elevated)', border: 'var(--border)',
        muted: 'var(--muted)', secondary: 'var(--secondary)', accent: 'var(--accent)',
        positive: 'var(--positive)', negative: 'var(--negative)', warning: 'var(--warning)', info: 'var(--info)'
      },
      fontFamily: { sans: ['var(--font-sans)', 'Arial', 'sans-serif'], mono: ['var(--font-mono)', 'monospace'] },
      boxShadow: { glow: '0 0 24px rgba(53, 211, 154, .12)' }
    }
  },
  plugins: []
}
