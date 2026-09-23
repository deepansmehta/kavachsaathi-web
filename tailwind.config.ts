import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4AF37",
          light: "#F2D060",
          dark: "#9A7A18",
          faint: "rgba(212,175,55,0.10)",
          border: "rgba(212,175,55,0.22)",
        },
        kavach: {
          black: "#080808",
          s1: "#111111",
          s2: "#1A1A1A",
          s3: "#242424",
          border: "rgba(212,175,55,0.15)",
        },
        cream: {
          DEFAULT: "#E6DFC8",
          soft: "rgba(230,223,200,0.55)",
        },
        danger: "#E53935",
        success: "#2EA843",
        background: "#080808",
        foreground: "#E6DFC8",
      },
      fontFamily: {
        rajdhani: ["var(--font-rajdhani)", "Rajdhani", "sans-serif"],
        body: ["var(--font-dm-sans)", "DM Sans", "sans-serif"],
        dm: ["var(--font-dm-sans)", "DM Sans", "sans-serif"],
        mono: ["var(--font-space-mono)", "Space Mono", "monospace"],
      },
      borderRadius: {
        card: "12px",
        input: "8px",
        badge: "99px",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #D4AF37, #F2D060)",
      },
      boxShadow: {
        "gold-glow":
          "0 0 20px rgba(212,175,55,0.25), 0 0 40px rgba(212,175,55,0.1)",
        "gold-sm": "0 0 10px rgba(212,175,55,0.15)",
      },
      animation: {
        "gold-pulse": "goldPulse 2s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        shimmer: "shimmer 3s ease-in-out infinite",
      },
      keyframes: {
        goldPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212,175,55,0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(212,175,55,0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%, 100%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
