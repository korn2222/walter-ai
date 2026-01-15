import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "rgb(var(--bg-app) / <alpha-value>)",
          sidebar: "rgb(var(--bg-sidebar) / <alpha-value>)",
          card: "rgb(var(--bg-card) / <alpha-value>)",
          text: {
            primary: "rgb(var(--text-primary) / <alpha-value>)",
            secondary: "rgb(var(--text-secondary) / <alpha-value>)",
            muted: "rgb(var(--text-muted) / <alpha-value>)",
          },
          accent: {
            DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
            hover: "rgb(var(--color-accent-hover) / <alpha-value>)",
            glow: "rgb(var(--color-accent-glow) / <alpha-value>)",
          },
          border: "rgb(var(--border-color) / <alpha-value>)",
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'app-gradient': 'linear-gradient(to bottom right, rgb(var(--bg-app)), #0f172a)',
        'accent-gradient': 'linear-gradient(135deg, rgb(var(--color-accent)), rgb(var(--color-accent-hover)))',
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgb(var(--color-accent-glow) / 0.5)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
