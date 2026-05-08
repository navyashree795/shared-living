/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Main theme tokens (mapped to CSS variables) ─────────────
        background:   'var(--background)',
        surface:      'var(--surface)',
        surfaceRaised:'var(--surface-raised)',
        primary:      '#6366F1',
        primaryLight: '#EEF2FF',
        secondary:    '#E0E7FF',
        textMain:     'var(--text-main)',
        textMuted:    'var(--text-muted)',
        textFaint:    'var(--text-faint)',
        border:       'var(--border)',
        success:      '#10B981',
        danger:       '#EF4444',
        warning:      '#F59E0B',
        // ── Dark mode surface overrides (used with dark: prefix) ──
        // bg-dark-bg, bg-dark-surface, etc.
        dark: {
          bg:          '#0F172A',
          surface:     '#1E293B',
          raised:      '#334155',
          border:      '#334155',
          textMain:    '#F1F5F9',
          textMuted:   '#94A3B8',
          textFaint:   '#475569',
          primary:     '#818CF8',
          primaryBg:   '#1E1B4B',
          success:     '#34D399',
          danger:      '#F87171',
          warning:     '#FBBF24',
        },
      },
    },
  },
  plugins: [],
}