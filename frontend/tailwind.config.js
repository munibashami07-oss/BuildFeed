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
        /* ── CSS-var backed semantic tokens (theme-aware) ── */
        paper:           "var(--bg-paper)",
        surface:         "var(--bg-surface)",
        raised:          "var(--bg-raised)",
        primary:         "var(--text-primary)",
        secondary:       "var(--text-secondary)",
        muted:           "var(--text-muted)",
        borderPaper:     "var(--border-paper)",
        borderSubtle:    "var(--border-subtle)",
        cardHoverBorder: "var(--card-hover-border)",

        /* ── Accent — indigo/violet ── */
        accent:          "#6366F1",
        accentHover:     "#4F46E5",
        accentLight:     "var(--accent-light)",
        accentVeryLight: "#EEF2FF",
        // Keep legacy alias so older components compile
        accentOrange:    "#6366F1",

        /* ── Emerald — used for direct-relevance + success ── */
        emerald: {
          DEFAULT: "#10B981",
          400: "#34D399",
          500: "#10B981",
        },

        /* ── Brand indigo ramp ── */
        brand: {
          50:  "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          900: "#1E1B4B",
        },

        /* ── Relevance tokens ── */
        relevance: {
          directBg:      "var(--relevance-direct-bg)",
          directText:    "var(--relevance-direct-text)",
          directBorder:  "var(--relevance-direct-border)",
          relatedBg:     "var(--relevance-related-bg)",
          relatedText:   "var(--relevance-related-text)",
          relatedBorder: "var(--relevance-related-border)",
        },

        /* ── Dark palette constants ── */
        darkBase:  "#0B0F19",
        darkSurf:  "#131927",
        darkRaised:"#161F33",
        darkBorder:"#1E293B",

        /* ── Legacy names kept for non-refactored pages ── */
        navy:     "#1E1B4B",
        darkBg:   "#0B0F19",
        darkCard: "#131927",
      },

      fontFamily: {
        heading: ["Inter", "sans-serif"],
        sans:    ["Inter", "Satoshi", "sans-serif"],
        mono:    ["JetBrains Mono", "Fira Code", "monospace"],
      },

      borderRadius: {
        DEFAULT: "6px",
        sm:      "4px",
        md:      "8px",
        lg:      "10px",
        xl:      "12px",
        "2xl":   "14px",
        "3xl":   "18px",
        "4xl":   "24px",
        card:    "12px",
      },

      boxShadow: {
        subtle:      "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
        card:        "0 4px 16px rgba(0,0,0,0.08)",
        elevated:    "0 8px 32px rgba(0,0,0,0.12)",
        overlay:     "0 16px 48px rgba(0,0,0,0.2)",
        purple:      "0 4px 16px rgba(99,102,241,0.28)",
        purpleHover: "0 6px 24px rgba(99,102,241,0.38)",
        glow:        "0 0 20px rgba(99,102,241,0.3)",
        emerald:     "0 4px 16px rgba(16,185,129,0.25)",
        inner:       "inset 0 1px 2px rgba(0,0,0,0.06)",
        dark:        "0 4px 24px rgba(0,0,0,0.45)",
      },

      spacing: {
        sidebar:  "252px",
        rightbar: "300px",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
}
