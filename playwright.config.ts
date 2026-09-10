import { defineConfig, devices } from '@playwright/test'

// Smoke harness: Chromium against `pnpm dev` with the in-memory Folder fixture
// standing in for the Rust side (see src/mock-tauri/vaultFixture.ts). One
// worker, local-only; CI does not run it. `pnpm smoke` starts the dev server
// on the Vite port unless one is already listening there.
const DEV_SERVER_PORT = 5202 // must match server.port in vite.config.ts
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
    command: 'pnpm dev',
    url: DEV_SERVER_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
