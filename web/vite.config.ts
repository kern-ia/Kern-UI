import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The Go binary serves the built SPA, so the build lands inside internal/httpapi.
// In dev, Vite serves the SPA and proxies the API to the Go process.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../internal/httpapi/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:7777',
      '/healthz': 'http://127.0.0.1:7777',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
