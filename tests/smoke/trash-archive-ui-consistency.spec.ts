import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

const NOTE_ITEM = '[data-testid="note-list-container"] .cursor-pointer'

test.describe('Trash/archive state consistency across UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('trashing a note shows TrashedNoteBanner and updates Properties', async ({ page }) => {
    // Select first note in the list
    const firstNote = page.locator(NOTE_ITEM).first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // Verify no trash banner initially
    await expect(page.locator('[data-testid="trashed-note-banner"]')).not.toBeVisible()

    // Trash via command palette
    await openCommandPalette(page)
    await executeCommand(page, 'Trash Note')
    await page.waitForTimeout(500)

    // Banner should appear
    await expect(page.locator('[data-testid="trashed-note-banner"]')).toBeVisible({ timeout: 3000 })

    // Toast should say "Note moved to trash", NOT "Property updated"
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText(/moved to trash/i, { timeout: 3000 })
  })

  test('archiving a note shows ArchivedNoteBanner', async ({ page }) => {
    // Select first note in the list
    const firstNote = page.locator(NOTE_ITEM).first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // Verify no archive banner initially
    await expect(page.locator('[data-testid="archived-note-banner"]')).not.toBeVisible()

    // Archive via command palette
    await openCommandPalette(page)
    await executeCommand(page, 'Archive Note')
    await page.waitForTimeout(500)

    // Banner should appear
    await expect(page.locator('[data-testid="archived-note-banner"]')).toBeVisible({ timeout: 3000 })
  })

  test('raw editor shows updated frontmatter after trash', async ({ page }) => {
    // Select first note
    const firstNote = page.locator(NOTE_ITEM).first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // Switch to raw editor mode
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw Editor')
    await page.waitForTimeout(300)

    const rawEditor = page.locator('[data-testid="raw-editor-codemirror"]')
    await expect(rawEditor).toBeVisible({ timeout: 3000 })

    // Trash the note
    await openCommandPalette(page)
    await executeCommand(page, 'Trash Note')
    await page.waitForTimeout(500)

    // Raw editor should show Trashed: true in frontmatter
    const editorText = await rawEditor.textContent()
    expect(editorText).toContain('Trashed')
  })

  test('Changes list updates after trashing a note', async ({ page }) => {
    const sidebar = page.locator('.app__sidebar')
    const secondaryArea = sidebar.locator('[data-testid="sidebar-secondary"]')
    const changesRow = secondaryArea.locator('div', { hasText: /^Changes/ }).first()
    await changesRow.waitFor({ timeout: 5000 })

    const badge = changesRow.locator('span').last()
    const initialCount = Number(await badge.textContent())

    // Select and trash a note
    const firstNote = page.locator(NOTE_ITEM).first()
    await firstNote.click()
    await page.waitForTimeout(300)

    await openCommandPalette(page)
    await executeCommand(page, 'Trash Note')

    // Badge count should increase
    await expect(async () => {
      const text = await badge.textContent()
      expect(Number(text)).toBeGreaterThan(initialCount)
    }).toPass({ timeout: 5000 })
  })
})
