/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Background Layer */
        background: "#030712",
        surface: "#0a0f1a",
        card: "#111827",
        elevated: "#1f2937",

        /* Accent Colors */
        accentCyan: "#06b6d4",
        accentRed: "#f43f5e",
        accentPurple: "#a78bfa",
        accentSuccess: "#10b981",
        accentWarning: "#f59e0b",

        /* Semantic Aliases */
        primary: "#06b6d4",
        secondary: "#f43f5e",
        tertiary: "#a78bfa",

        /* Text */
        secondaryText: "#9ca3af",
        tertiaryText: "#6b7280",
      },
      fontFamily: {
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        satoshi: ["Outfit", "Inter", "system-ui", "sans-serif"],
        sfpro: ["SF Pro Display", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg':   ['18px', { lineHeight: '28px' }],
        'xl':   ['20px', { lineHeight: '28px' }],
        '2xl':  ['24px', { lineHeight: '32px' }],
        '3xl':  ['30px', { lineHeight: '36px' }],
        '4xl':  ['36px', { lineHeight: '40px' }],
        '5xl':  ['48px', { lineHeight: '1' }],
        '6xl':  ['60px', { lineHeight: '1' }],
        '7xl':  ['72px', { lineHeight: '1' }],
      },
      borderRadius: {
        'sm':  '6px',
        'md':  '10px',
        'lg':  '16px',
        'xl':  '24px',
        '2xl': '32px',
      },
      animation: {
        "pulse-glow": "pulseGlow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scanner-sweep": "scannerSweep 3s linear infinite",
        "mesh-move": "meshMove 10s ease infinite",
        "float-particle": "floatParticle 8s ease-in-out infinite",
        "border-glow": "borderGlow 4s linear infinite",
        "neural-pulse": "neuralPulse 3s ease-in-out infinite",
        "scan-line": "scanLine 2s linear infinite",
        "fade-in": "fadeInUp 0.5s ease-out forwards",
        "shimmer": "shimmer 2s infinite",
        "float-slow": "floatSlow 6s ease-in-out infinite",
        "pulse-slow": "pulseSlow 8s ease-in-out infinite",
        "gradient-shift": "gradientShift 12s ease infinite",
        "cursor-drift": "cursorDrift 15s ease-in-out infinite",
        "spin-slow": "spin 30s linear infinite",
      },
      keyframes: {
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        cursorDrift: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(200px, 150px)" },
          "50%": { transform: "translate(-150px, 300px)" },
          "75%": { transform: "translate(-300px, -100px)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: 0.2, transform: "scale(1)" },
          "50%": { opacity: 0.5, transform: "scale(1.08)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-16px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: 0.2, filter: "drop-shadow(0 0 2px rgba(6, 182, 212, 0.15))" },
          "50%": { opacity: 0.7, filter: "drop-shadow(0 0 12px rgba(6, 182, 212, 0.4))" },
        },
        scannerSweep: {
          "0%": { transform: "translateY(-100%)" },
          "50%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(-100%)" },
        },
        meshMove: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.95)" },
        },
        floatParticle: {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)", opacity: 0.08 },
          "50%": { transform: "translateY(-30px) translateX(10px)", opacity: 0.3 },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(244, 63, 94, 0.2)" },
          "50%": { borderColor: "rgba(6, 182, 212, 0.4)" },
        },
        neuralPulse: {
          "0%, 100%": { opacity: 0.2, transform: "scale(1)" },
          "50%": { opacity: 0.6, transform: "scale(1.2)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(200%)" },
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
}
