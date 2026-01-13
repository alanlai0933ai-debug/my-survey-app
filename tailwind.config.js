/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // 👇 請確認這一行一字不漏，包含 ** (掃描子資料夾) 和 jsx (您的檔案格式)
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}