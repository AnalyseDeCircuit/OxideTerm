import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { initializeTheme } from './lib/themeManager'

// Initialize theme before rendering
initializeTheme()

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Cleanup on window close to prevent memory leaks
window.addEventListener('beforeunload', () => {
  root.unmount()
})
