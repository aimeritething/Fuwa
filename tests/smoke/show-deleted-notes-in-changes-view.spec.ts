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

  test('changes view shows deleted notes as rows instead of a banner', async ({ page }) => {
    await navigateToChanges(page)
    const deletedRow = page.locator('[data-change-status="deleted"]').filter({ hasText: 'old-draft.md' })
    await expect(deletedRow).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="deleted-notes-banner"]')).toHaveCount(0)
  })

  test('clicking a deleted row opens its deleted diff preview', async ({ page }) => {
    await navigateToChanges(page)
    await page.getByText('old-draft.md').click()
    await expect(page.getByText('Back to editor')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('This note was deleted.')).toBeVisible({ timeout: 5000 })
  })

  test('deleted rows expose a restore action from the context menu', async ({ page }) => {
    await navigateToChanges(page)
    await page.getByText('old-draft.md').click({ button: 'right' })
    await expect(page.locator('[data-testid="changes-context-menu"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="restore-note-button"]')).toBeVisible({ timeout: 5000 })
  })
})
