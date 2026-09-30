import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three.js (lazy 3D hero) is ~1 MB on its own; it is split out, so silence the warning
  build: { chunkSizeWarningLimit: 1100 },
})
