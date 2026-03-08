import { test, expect } from '@playwright/test'
import { openCommandPalette, findCommand, executeCommand } from './helpers'

test.describe('Three source of truth', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Reload Vault command appears in Cmd+K palette', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'reload')
    expect(found).toBe(true)
  })

  test('Reload Vault command is executable', async ({ page }) => {
    await openCommandPalette(page)
    await executeCommand(page, 'reload vault')
    // After execution, palette should close and app should still render
    await expect(page.locator('input[placeholder="Type a command..."]')).not.toBeVisible()
    // Sidebar should still be visible after reload
    await expect(page.locator('[data-testid="sidebar"], nav, aside').first()).toBeVisible()
  })

  test('Reload Vault findable by keyword "rescan"', async ({ page }) => {
    await openCommandPalette(page)
    // Type a keyword synonym — the command should appear as selected result
    await page.locator('input[placeholder="Type a command..."]').fill('rescan')
    const match = page.locator('[data-selected="true"]').first()
    await match.waitFor({ timeout: 2_000 })
    const text = await match.textContent()
    expect(text?.toLowerCase()).toContain('reload')
  })
})
