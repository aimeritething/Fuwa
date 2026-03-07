import { test, expect } from '@playwright/test'
import {
  openCommandPalette,
  findCommand,
  executeCommand,
} from './helpers'

test.describe('Reindex Vault smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Reindex Vault command appears in command palette', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'Reindex Vault')
    expect(found).toBe(true)
  })

  test('Reindex Vault command triggers indexing progress', async ({ page }) => {
    await openCommandPalette(page)
    await executeCommand(page, 'Reindex Vault')

    // After triggering reindex, the indexing badge should appear in the status bar
    const indexingBadge = page.locator('[data-testid="status-indexing"], [data-testid="status-indexed-time"]')
    await expect(indexingBadge.first()).toBeVisible({ timeout: 5_000 })
  })
})
