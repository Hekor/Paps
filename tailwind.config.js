/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3C0A5B',          // Deep Purple
        accent: '#D8572A',           // Orange-Pink
        background: '#1A0E23',       // Dark Plum
        surface: '#2B183A',          // Dark Mauve
        textPrimary: '#EDEDED',      // Soft White
        textSecondary: '#A8A8A8',    // Light Gray
        gradientStart: '#8E2DE2',    // Optional gradient
        gradientEnd: '#D8572A'
      },
    },
  },
  plugins: [],
}
