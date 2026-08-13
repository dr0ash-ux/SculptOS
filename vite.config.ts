import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local development proxy: the browser talks to Vite, and Vite forwards DICOM
// requests to the local Orthanc container. This avoids browser CORS issues.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/orthanc': {
        target: 'http://localhost:8042',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/orthanc/, ''),
        auth: 'orthanc:orthanc',
      },
    },
  },
})
