/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    require("daisyui"),
    require("tailwind-scrollbar")
  ],
  daisyui: {
    themes: ["dark", "light", "winter"],
    darkTheme: "dark",
    base: false,
  },
  variants: {
    scrollbar: ["rounded"],
  },
};
