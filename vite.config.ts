/// <reference types="vitest/config" />
import fs from 'fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const STYLE_CATALOG_IMAGES = path.resolve(__dirname, './src/platform/mock/style-catalog/images')
const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

// Outside Tauri nothing resolves a Document's picture against its own directory,
// so the browser asks the dev server for a style catalog Document's
// `../images/<name>` as `/images/<name>`. Dev server only; a build has no catalog.
function styleCatalogImages(): Plugin {
  return {
    name: 'plumo:style-catalog-images',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/images', (request, response, next) => {
        const name = path.basename(decodeURIComponent((request.url ?? '').split(/[?#]/u)[0]))
        const type = IMAGE_TYPES[path.extname(name).toLowerCase()]
        const file = path.join(STYLE_CATALOG_IMAGES, name)
        if (!type || !fs.existsSync(file)) return next()
        response.setHeader('Content-Type', type)
        fs.createReadStream(file).pipe(response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), styleCatalogImages()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5202,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    maxWorkers: 4,
    testTimeout: 10_000,
  },
})
