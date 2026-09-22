import { defineConfig, devices } from '@playwright/test'

// Smoke harness: Chromium against `pnpm dev` with the in-memory Folder fixture
// standing in for the Rust side (see src/platform/mock/vault-fixture.ts). One
// worker, local-only; CI does not run it. `pnpm smoke` starts the dev server
// on the Vite port unless one is already listening there; set PLUMO_SMOKE_PORT
// to run against a second checkout while another dev server holds the port.
const DEV_SERVER_PORT = Number(process.env.PLUMO_SMOKE_PORT ?? 5202) // the default is server.port in vite.config.ts
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: DEV_SERVER_URL,
    viewport: { width: 1200, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `pnpm dev --port ${DEV_SERVER_PORT}`,
    url: DEV_SERVER_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
