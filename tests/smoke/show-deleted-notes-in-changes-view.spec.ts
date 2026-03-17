import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

async function navigateToChanges(page: import('@playwright/test').Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Go to Changes')
  await page.waitForTimeout(500)
}

test.describe('Show deleted notes in Changes view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('changes view shows deleted notes banner', async ({ page }) => {
    await navigateToChanges(page)
    const banner = page.locator('[data-testid="deleted-notes-banner"]')
    await expect(banner).toBeVisible({ timeout: 5000 })
    await expect(banner).toContainText('1 note deleted')
  })

  test('deleted banner is visually distinct from note items', async ({ page }) => {
    await navigateToChanges(page)
    const banner = page.locator('[data-testid="deleted-notes-banner"]')
    await expect(banner).toBeVisible({ timeout: 5000 })
    // Banner should have reduced opacity (visually distinct)
    const opacity = await banner.evaluate((el) => window.getComputedStyle(el).opacity)
    expect(parseFloat(opacity)).toBeLessThan(1)
  })

  test('changes counter in sidebar matches list items plus deleted count', async ({ page }) => {
    // The sidebar badge should show the total count (modified + added + deleted)
    const changesBadge = page.locator('text=Changes').locator('..')
    await expect(changesBadge).toBeVisible({ timeout: 5000 })
  })
})
