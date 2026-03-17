import { test, expect } from '@playwright/test'
import { openCommandPalette, findCommand, executeCommand, sendShortcut } from './helpers'

test.describe('Note icon emoji picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
  })

  test('emoji picker opens from Add Icon button and selects emoji', async ({ page }) => {
    // Open a note by clicking the first item in the note list
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // The note icon area should be visible
    const iconArea = page.locator('[data-testid="note-icon-area"]')
    await expect(iconArea).toBeVisible({ timeout: 3000 })

    // Hover to reveal the "Add icon" button and click it
    await iconArea.hover()
    const addButton = page.locator('[data-testid="note-icon-add"]')
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Emoji picker should appear
    const picker = page.locator('[data-testid="emoji-picker"]')
    await expect(picker).toBeVisible({ timeout: 2000 })

    // Click the first emoji
    const emojiOption = picker.locator('[data-testid="emoji-option"]').first()
    await emojiOption.click()

    // Picker should close
    await expect(picker).not.toBeVisible()

    // The icon should now be displayed
    const iconDisplay = page.locator('[data-testid="note-icon-display"]')
    await expect(iconDisplay).toBeVisible({ timeout: 2000 })
  })

  test('emoji icon can be removed via menu', async ({ page }) => {
    // Open a note
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // Add an icon first
    const iconArea = page.locator('[data-testid="note-icon-area"]')
    await iconArea.hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await page.locator('[data-testid="emoji-option"]').first().click()
    await page.waitForTimeout(300)

    // Click the displayed icon to show the menu
    const iconDisplay = page.locator('[data-testid="note-icon-display"]')
    await iconDisplay.click()

    // Menu should show Remove option
    const removeButton = page.locator('[data-testid="note-icon-remove"]')
    await expect(removeButton).toBeVisible()
    await removeButton.click()

    // Icon should be removed, add button returns on hover
    await expect(iconDisplay).not.toBeVisible()
    await iconArea.hover()
    await expect(page.locator('[data-testid="note-icon-add"]')).toBeVisible()
  })

  test('Cmd+K shows Set Note Icon command', async ({ page }) => {
    // Open a note first
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // Open command palette and search for the icon command
    await openCommandPalette(page)
    const found = await findCommand(page, 'Set Note Icon')
    expect(found).toBe(true)
  })

  test('Set Note Icon command opens emoji picker', async ({ page }) => {
    // Open a note first
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // Use command palette to open emoji picker
    await openCommandPalette(page)
    await executeCommand(page, 'Set Note Icon')
    await page.waitForTimeout(300)

    // Emoji picker should be visible
    const picker = page.locator('[data-testid="emoji-picker"]')
    await expect(picker).toBeVisible({ timeout: 2000 })

    // Select an emoji
    await picker.locator('[data-testid="emoji-option"]').first().click()

    // Icon should be displayed
    const iconDisplay = page.locator('[data-testid="note-icon-display"]')
    await expect(iconDisplay).toBeVisible({ timeout: 2000 })
  })

  test('Escape closes the emoji picker', async ({ page }) => {
    // Open a note
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    await noteItem.click()
    await page.waitForTimeout(500)

    // Open picker
    const iconArea = page.locator('[data-testid="note-icon-area"]')
    await iconArea.hover()
    await page.locator('[data-testid="note-icon-add"]').click()

    const picker = page.locator('[data-testid="emoji-picker"]')
    await expect(picker).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await expect(picker).not.toBeVisible()
  })

  test('emoji icon is shown in Quick Open (Cmd+P) results', async ({ page }) => {
    // Open a note and set an icon
    const noteItem = page.locator('[data-testid="note-list-container"] .cursor-pointer').first()
    await noteItem.waitFor({ timeout: 5000 })
    // Get the note title for later search
    const noteTitle = await noteItem.locator('.font-medium, .text-sm').first().textContent()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Set an icon
    const iconArea = page.locator('[data-testid="note-icon-area"]')
    await iconArea.hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    const firstEmoji = page.locator('[data-testid="emoji-option"]').first()
    const emojiText = await firstEmoji.textContent()
    await firstEmoji.click()
    await page.waitForTimeout(500)

    // Open Quick Open and search for the note
    await page.locator('body').click()
    await sendShortcut(page, 'p', ['Control'])
    const searchInput = page.locator('input[placeholder="Search notes..."]')
    await expect(searchInput).toBeVisible()

    if (noteTitle && emojiText) {
      await searchInput.fill(noteTitle.trim().substring(0, 10))
      await page.waitForTimeout(300)

      // Verify the emoji appears in the search results
      const results = page.locator('.py-1 .cursor-pointer .truncate')
      const resultTexts = await results.allTextContents()
      const hasEmoji = resultTexts.some(t => t.includes(emojiText))
      expect(hasEmoji).toBe(true)
    }
  })
})
