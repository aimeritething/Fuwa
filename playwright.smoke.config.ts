import { defineConfig } from '@playwright/test'

const baseURL = process.env.BASE_URL || 'http://localhost:5201'
const port = process.env.BASE_URL?.match(/:(\d+)/)?.[1] || '5201'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  grep: /@smoke/,
  use: {
    baseURL,
    headless: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
  },
})
