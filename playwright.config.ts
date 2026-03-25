import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 20_000,
  retries: 2,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5201',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm dev --port ${process.env.BASE_URL?.match(/:(\d+)/)?.[1] || '5201'}`,
    url: process.env.BASE_URL || 'http://localhost:5201',
    reuseExistingServer: true,
  },
})
