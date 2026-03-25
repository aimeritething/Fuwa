import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

async function openSettings(page: import('@playwright/test').Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Settings')
  const panel = page.locator('[data-testid="settings-panel"]')
  await panel.waitFor({ timeout: 5000 })
  return panel
}

test.describe('Canary release channel + feature flags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Settings panel shows Update channel dropdown defaulting to Stable', async ({ page }) => {
    await openSettings(page)

    // Check the Updates section exists
    await expect(page.getByText('Updates')).toBeVisible()
    await expect(page.getByText('Canary builds include')).toBeVisible()

    // Check the dropdown defaults to stable
    const select = page.locator('[data-testid="settings-update-channel"]')
    await expect(select).toBeVisible()
    await expect(select).toHaveValue('stable')
  })

  test('Update channel can be changed to canary and saved', async ({ page }) => {
    await openSettings(page)

    // Change to canary
    const select = page.locator('[data-testid="settings-update-channel"]')
    await select.selectOption('canary')
    await expect(select).toHaveValue('canary')

    // Save (closes the panel)
    await page.click('[data-testid="settings-save"]')
    await page.waitForTimeout(500)

    // Reopen settings and verify the value persisted
    await openSettings(page)
    const reopenedSelect = page.locator('[data-testid="settings-update-channel"]')
    await expect(reopenedSelect).toHaveValue('canary')
  })
})
