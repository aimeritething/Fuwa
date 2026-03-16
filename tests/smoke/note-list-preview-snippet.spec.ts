import { test, expect } from '@playwright/test'

test.describe('Note list preview snippet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('notes with content show a snippet in the note list', async ({ page }) => {
    // The note list should be visible with entries that have snippets
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    // The snippet text lives in a 12px muted-foreground div inside each note item.
    // At least one must contain real text (10+ word-chars) — not just a date.
    const snippetElements = noteListContainer.locator('.text-\\[12px\\]').filter({
      hasText: /\w{10,}/,
    })
    const count = await snippetElements.count()
    expect(count).toBeGreaterThan(0)
  })

  test('snippet does not contain raw markdown formatting', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    // Check snippet divs for absence of raw markdown
    const snippetDivs = noteListContainer.locator('.text-\\[12px\\]')
    const snippetCount = await snippetDivs.count()

    for (let i = 0; i < Math.min(snippetCount, 5); i++) {
      const text = await snippetDivs.nth(i).textContent()
      if (text && text.length > 10) {
        expect(text).not.toMatch(/\*\*[^*]+\*\*/)  // no **bold**
        expect(text).not.toContain('```')  // no code fences
        expect(text).not.toMatch(/\[\[.*\]\]/)  // no raw wikilinks
      }
    }
  })

  test('snippet does not start with list markers', async ({ page }) => {
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    const snippetDivs = noteListContainer.locator('.text-\\[12px\\]')
    const snippetCount = await snippetDivs.count()

    for (let i = 0; i < Math.min(snippetCount, 10); i++) {
      const text = await snippetDivs.nth(i).textContent()
      if (text && text.length > 5) {
        // Snippet text should not start with bullet markers
        expect(text.trimStart()).not.toMatch(/^[*\-+] /)
        expect(text.trimStart()).not.toMatch(/^\d+\. /)
      }
    }
  })
})
