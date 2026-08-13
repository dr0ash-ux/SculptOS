import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ImagingWorkspace from './ImagingWorkspace'
import './imaging-bridge.css'

/**
 * Keeps the existing dashboard intact while the Imaging module is wired into
 * the main application shell. It listens for the existing sidebar's Imaging
 * action and presents the real Orthanc/Cornerstone workspace above it.
 */
export default function ImagingBridge() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('button.nav-item')
      if (button?.textContent?.trim().includes('Imaging')) setOpen(true)
    }

    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  if (!open) return null

  return createPortal(
    <div className="imaging-bridge-overlay">
      <div className="imaging-bridge-shell">
        <button className="imaging-bridge-close" onClick={() => setOpen(false)} aria-label="Close imaging workspace">
          ×
        </button>
        <ImagingWorkspace />
      </div>
    </div>,
    document.body,
  )
}
