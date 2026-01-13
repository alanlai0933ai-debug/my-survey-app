import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 引用我們剛剛整理好的 App
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode> // 如果拖曳有問題可以暫時註解這行
    <App />
  // </React.StrictMode>,
)