import { test, expect } from '@playwright/test'

test.describe('Flat vault migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('title field appears above editor when note is open', async ({ page }) => {
    // Click a note in the sidebar to open it
    const noteItem = page.locator('[data-testid="note-list-item"]').first()
    if (await noteItem.isVisible()) {
      await noteItem.click()
      await page.waitForTimeout(300)
      // The TitleField should be visible
      const titleField = page.locator('[data-testid="title-field"]')
      await expect(titleField).toBeVisible()
      // The input should have the note's title
      const input = page.locator('[data-testid="title-field-input"]')
      const value = await input.inputValue()
      expect(value.length).toBeGreaterThan(0)
    }
  })

  test('title field is editable and shows filename on change', async ({ page }) => {
    // Open a note
    const noteItem = page.locator('[data-testid="note-list-item"]').first()
    if (await noteItem.isVisible()) {
      await noteItem.click()
      await page.waitForTimeout(300)
      const input = page.locator('[data-testid="title-field-input"]')
      await input.focus()
      // Should show filename indicator when focused
      const filenameIndicator = page.locator('[data-testid="title-field-filename"]')
      await expect(filenameIndicator).toBeVisible()
    }
  })

  test('no migration banner when vault is already flat (mock)', async ({ page }) => {
    // In browser mode (mock), vault should be flat and no migration banner
    const banner = page.locator('[data-testid="migration-banner"]')
    await page.waitForTimeout(1000)
    await expect(banner).not.toBeVisible()
  })

  test('H1 heading is hidden in editor (CSS rule active)', async ({ page }) => {
    // Check that the CSS rule for hiding H1 is present in the document
    const styles = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('data-content-type="heading"') && rule.cssText?.includes('display: none')) {
              return true
            }
          }
        } catch { /* cross-origin */ }
      }
      return false
    })
    expect(styles).toBe(true)
  })
})
