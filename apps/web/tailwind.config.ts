import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Locked warm-stone design tokens (see app/globals.css :root).
        surface: "var(--panel)",
        ink: "var(--ink)",
        muted: "var(--ink-mute)",
        accent: "var(--accent)",
        "accent-wash": "var(--accent-wash)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        green: "var(--green)",
      },
    },
  },
  plugins: [],
};

export default config;
