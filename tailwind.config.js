/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 確保這行路徑包含 jsx
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}