import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './lib/sentry'
import { SentryErrorBoundary } from './components/sentry-error-boundary'
import { ThemeProvider } from './lib/theme'
import './index.css'
import App from './App.tsx'

initSentry()

// Register service worker for PWA/offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SentryErrorBoundary>
        <App />
      </SentryErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
