import { test, expect } from '@playwright/test'

test('accepting telemetry consent on a fresh start opens the vault choice wizard @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()

    let ref: Record<string, unknown> | null = null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>

        const originalGetSettings = ref.get_settings as (() => Record<string, unknown>) | undefined
        ref.get_settings = () => ({
          ...(originalGetSettings ? originalGetSettings() : {}),
          telemetry_consent: null,
          crash_reporting_enabled: null,
          analytics_enabled: null,
          anonymous_id: null,
        })
        ref.load_vault_list = () => ({
          vaults: [],
          active_vault: null,
          hidden_defaults: [],
        })
        ref.get_default_vault_path = () => '/Users/mock/Documents/Getting Started'
        ref.check_vault_exists = (args: { path?: string }) => args?.path === '/Users/mock/Documents/Getting Started'
      },
      get() {
        return ref
      },
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Help improve Tolaria')).toBeVisible()
  await page.getByTestId('telemetry-accept').click()

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByTestId('welcome-open-folder')).toBeVisible()
  await expect(page.getByTestId('welcome-create-new')).toBeFocused()
})
