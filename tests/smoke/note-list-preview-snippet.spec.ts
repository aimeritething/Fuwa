import { test, expect } from '@playwright/test'

test.describe('Note list preview snippet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('notes with content show a snippet in the note list', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    // Wait for note items to render (cursor-pointer items inside the container)
    const noteItems = noteListContainer.locator('.cursor-pointer')
    await expect(noteItems.first()).toBeVisible({ timeout: 5000 })

    // Each note item has a snippet div: 12px text with muted-foreground
    // Check that at least one note has text content in its snippet area
    const snippets = noteListContainer.locator('.text-muted-foreground')
    const count = await snippets.count()
    let foundSnippet = false
    for (let i = 0; i < count; i++) {
      const text = await snippets.nth(i).textContent()
      if (text && text.length > 15 && !/^\d/.test(text.trim())) {
        foundSnippet = true
        break
      }
    }
    expect(foundSnippet).toBe(true)
  })

  test('snippet does not contain raw markdown formatting', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    const snippets = noteListContainer.locator('.text-muted-foreground')
    const count = await snippets.count()

    for (let i = 0; i < Math.min(count, 8); i++) {
      const text = await snippets.nth(i).textContent()
      if (text && text.length > 10) {
        expect(text).not.toMatch(/\*\*[^*]+\*\*/)
        expect(text).not.toContain('```')
        expect(text).not.toMatch(/\[\[.*\]\]/)
      }
    }
  })

  test('snippet does not start with list markers', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    const snippets = noteListContainer.locator('.text-muted-foreground')
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
