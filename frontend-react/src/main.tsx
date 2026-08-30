import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './lib/sentry'
import { SentryErrorBoundary } from './components/sentry-error-boundary'
import './index.css'
import App from './App.tsx'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary>
      <App />
    </SentryErrorBoundary>
  </StrictMode>,
)
