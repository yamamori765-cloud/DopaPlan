import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0e9fe",
          200: "#c7d6fd",
          300: "#a4b8fa",
          400: "#8093f5",
          500: "#626eed",
          600: "#4f52e3",
          700: "#4142c8",
          800: "#3739a2",
          900: "#313380",
        },
      },
    },
  },
  plugins: [],
};
export default config;
