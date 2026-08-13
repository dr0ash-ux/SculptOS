import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ImagingBridge from './ImagingBridge.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ImagingBridge />
  </StrictMode>,
)
