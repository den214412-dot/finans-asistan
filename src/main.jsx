import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const style = document.createElement('style')
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Nunito', sans-serif; background: #F7F8FC; }
`
document.head.appendChild(style)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
