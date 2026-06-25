import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // App canvas + layered surfaces (deep navy, subtly elevated).
        app: "#0A0F1E",
        surface: {
          DEFAULT: "#121829",
          raised: "#182034",
          sunken: "#0C1120",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.14)",
        },
        // Text tiers.
        ink: {
          DEFAULT: "#ECEEF3",
          soft: "#9AA3B8",
          faint: "#646E86",
        },
        // Primary accent + chart accents.
        brand: {
          DEFAULT: "#3B82F6",
          dark: "#2563EB",
          soft: "rgba(59,130,246,0.14)",
        },
        accent: {
          sky: "#38BDF8",
          violet: "#A78BFA",
          amber: "#FBBF24",
          rose: "#FB7185",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.7)",
        pop: "0 16px 40px -12px rgba(0,0,0,0.65)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
