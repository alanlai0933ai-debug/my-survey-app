// postcss.config.cjs
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}, // 這是解決錯誤的關鍵改動
    'autoprefixer': {},
  },
}