import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { initializeTheme } from './lib/themeManager'
import { saveUIState } from './store/appStore'

// Initialize theme before rendering
initializeTheme()

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Cleanup on window close to prevent memory leaks
// Also save UI state (tabs, sidebar) for restoration on next launch
window.addEventListener('beforeunload', () => {
  saveUIState()
  root.unmount()
})
