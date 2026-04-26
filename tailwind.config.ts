import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#05060a",
        panel: "#0a0c14",
        neon: "#ff7900",        // ledger orange (primary brand)
        neonOrange: "#ff7900",  // alias for backwards compat
        muted: "#8a93a6",
        line: "#1a1d28",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(255,121,0,.35), 0 0 32px rgba(255,121,0,.15)",
      },
    },
  },
  plugins: [],
};
export default config;
