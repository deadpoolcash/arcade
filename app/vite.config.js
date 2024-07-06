import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true, // Ensure source maps are enabled for the build
  },
  server: {
    sourcemap: true, // Ensure source maps are enabled for the dev server
  },
})
