import { test, expect, type Page } from '@playwright/test'

const REMEMBERED_DEFAULT_VAULT_PATH = '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2'

async function mockFreshStart(
  page: Page,
  options: {
    activeVault: string | null
    checkExistingPath: string
    rememberWelcomeDismissal?: boolean
  },
) {
  await page.addInitScript((config) => {
    localStorage.clear()
    if (config.rememberWelcomeDismissal) {
      localStorage.setItem('tolaria_welcome_dismissed', '1')
    }

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
          active_vault: config.activeVault,
          hidden_defaults: [],
        })
        ref.get_default_vault_path = () => config.checkExistingPath
        ref.check_vault_exists = (args: { path?: string }) => args?.path === config.checkExistingPath
      },
      get() {
        return ref
      },
    })
  }, options)
}

test('accepting telemetry consent on a fresh start opens the vault choice wizard @smoke', async ({ page }) => {
  await mockFreshStart(page, {
    activeVault: null,
    checkExistingPath: '/Users/mock/Documents/Getting Started',
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Help improve Tolaria')).toBeVisible()
  await page.getByTestId('telemetry-accept').click()

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByTestId('welcome-open-folder')).toBeVisible()
  await expect(page.getByTestId('welcome-create-vault')).toBeFocused()
})

test('telemetry consent still leaves the welcome wizard fully keyboard navigable @smoke', async ({ page }) => {
  await mockFreshStart(page, {
    activeVault: null,
    checkExistingPath: '/Users/mock/Documents/Getting Started',
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('telemetry-decline')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('telemetry-accept')).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByTestId('welcome-create-vault')).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByTestId('welcome-create-new')).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByTestId('welcome-open-folder')).toBeFocused()

  let dialogHandled = false
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Open vault folder')
    await dialog.dismiss()
    dialogHandled = true
  })
  await page.keyboard.press('Enter')
  await expect.poll(() => dialogHandled).toBe(true)

  await expect(page.getByTestId('welcome-screen')).toBeVisible()

  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('welcome-create-new')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('welcome-create-vault')).toBeFocused()
})

for (const action of ['accept', 'decline'] as const) {
  test(`${action} telemetry still resumes onboarding with only a remembered default vault @smoke`, async ({ page }) => {
    await mockFreshStart(page, {
      activeVault: REMEMBERED_DEFAULT_VAULT_PATH,
      checkExistingPath: REMEMBERED_DEFAULT_VAULT_PATH,
      rememberWelcomeDismissal: true,
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Help improve Tolaria')).toBeVisible()
    await page.getByTestId(`telemetry-${action}`).click()

    await expect(page.getByTestId('welcome-screen')).toBeVisible()
    await expect(page.getByTestId('welcome-open-folder')).toBeVisible()
  })
}
