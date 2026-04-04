import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

async function openSettings(page: import('@playwright/test').Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Settings')
  const panel = page.locator('[data-testid="settings-panel"]')
  await panel.waitFor({ timeout: 5000 })
  return panel
}

test.describe('Release channel settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Settings panel shows Release channel dropdown defaulting to Stable', async ({ page }) => {
    await openSettings(page)

    // Check the Release Channel section exists
    await expect(page.getByText('Release Channel')).toBeVisible()

    // Check the dropdown defaults to stable
    const select = page.locator('[data-testid="settings-release-channel"]')
    await expect(select).toBeVisible()
    await expect(select).toHaveValue('stable')

    // Update channel should NOT be present
    await expect(page.locator('[data-testid="settings-update-channel"]')).not.toBeVisible()
  })

  test('Release channel can be changed to alpha and saved', async ({ page }) => {
    await openSettings(page)

    // Change to alpha
    const select = page.locator('[data-testid="settings-release-channel"]')
    await select.selectOption('alpha')
    await expect(select).toHaveValue('alpha')

    // Save (closes the panel)
    await page.click('[data-testid="settings-save"]')
    await page.waitForTimeout(500)

    // Reopen settings and verify the value persisted
    await openSettings(page)
    const reopenedSelect = page.locator('[data-testid="settings-release-channel"]')
    await expect(reopenedSelect).toHaveValue('alpha')
  })
})
