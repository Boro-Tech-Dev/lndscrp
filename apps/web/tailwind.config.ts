import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        accent: {
          green: "rgb(var(--color-accent-green) / <alpha-value>)",
          brown: "rgb(var(--color-accent-brown) / <alpha-value>)"
        }
      },
      borderRadius: {
        soft: "0.5rem"
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }]
      },
      keyframes: {
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" }
        }
      },
      animation: {
        ticker: "ticker 18s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
