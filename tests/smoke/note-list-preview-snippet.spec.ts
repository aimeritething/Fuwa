import { test, expect } from '@playwright/test'

test.describe('Note list preview snippet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('snippet does not contain raw markdown formatting', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    const snippets = noteListContainer.locator('[data-testid="note-snippet"]')
    const count = await snippets.count()

    for (let i = 0; i < Math.min(count, 8); i++) {
      const text = await snippets.nth(i).textContent()
      if (text && text.length > 10) {
        expect(text).not.toMatch(/\*\*[^*]+\*\*/)
        expect(text).not.toContain('```')
      }
    }
  })

  test('snippet does not start with list markers', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    const snippets = noteListContainer.locator('[data-testid="note-snippet"]')
    const count = await snippets.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await snippets.nth(i).textContent()
      if (text && text.length > 15) {
        expect(text.trimStart()).not.toMatch(/^[*\-+] /)
        expect(text.trimStart()).not.toMatch(/^\d+\. /)
      }
    }
  })
})
