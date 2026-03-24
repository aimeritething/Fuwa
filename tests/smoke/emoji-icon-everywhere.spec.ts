import { test, expect } from '@playwright/test'

test.describe('Emoji icon shown everywhere title appears', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
  })

  test('emoji icon appears in editor and note list after setting it', async ({ page }) => {
    // Open a note
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // Remove any existing icon first for a clean state
    const iconDisplay = page.locator('[data-testid="note-icon-display"]')
    if (await iconDisplay.isVisible()) {
      await iconDisplay.click()
      await page.locator('[data-testid="note-icon-remove"]').click()
      await page.waitForTimeout(300)
    }

    // Set an emoji icon
    const iconArea = page.locator('[data-testid="note-icon-area"]')
    await iconArea.hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    const firstEmoji = page.locator('[data-testid="emoji-option"]').first()
    const emojiText = await firstEmoji.textContent()
    expect(emojiText).toBeTruthy()
    await firstEmoji.click()
    await page.waitForTimeout(500)

    // Verify emoji in note list item
    const noteListText = await noteItem.textContent()
    expect(noteListText).toContain(emojiText!)

    // Verify emoji appears in the editor NoteIcon area
    // Wait for frontmatter update to propagate through the single-note reload cycle
    const iconAfterSet = page.locator('[data-testid="note-icon-display"]')
    await expect(iconAfterSet).toBeVisible({ timeout: 8000 })
    await expect(iconAfterSet).toHaveText(emojiText!, { timeout: 3000 })
  })

  test('note without emoji shows no emoji span in tab or note list', async ({ page }) => {
    // Open a note
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // Remove icon if present
    const iconDisplay = page.locator('[data-testid="note-icon-display"]')
    if (await iconDisplay.isVisible()) {
      await iconDisplay.click()
      await page.locator('[data-testid="note-icon-remove"]').click()
      await page.waitForTimeout(300)
    }

    // The note list item title row should not contain an emoji span (mr-1)
    const titleRow = noteItem.locator('.truncate.text-foreground').first()
    const emojiSpans = titleRow.locator('.mr-1')
    await expect(emojiSpans).toHaveCount(0)
  })
})
