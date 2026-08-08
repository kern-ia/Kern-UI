import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The Go binary serves the built SPA, so the default (VITE_BRAND unset, meaning "kern")
// build lands inside internal/httpapi — unchanged from before brand support existed.
// A brand build (VITE_BRAND=avel npm run build) lands in its own sibling dist-<brand>/
// instead, so building a second brand never clobbers the default one — each gets its
// own kern-ui deployment, pointed at its own dist via KERN_UI_WEB_DIR. See README.md,
// "Theming — one codebase, several client brands".
// In dev, Vite serves the SPA and proxies the API to the Go process.
//
// Defaulted here rather than in a .env file: this repo's .gitignore excludes .env
// (secrets live there in dev), which would silently swallow a committed brand default.
process.env.VITE_BRAND = process.env.VITE_BRAND || 'kern'
const brand = process.env.VITE_BRAND
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: brand === 'kern' ? '../internal/httpapi/dist' : `../dist-${brand}`,
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
