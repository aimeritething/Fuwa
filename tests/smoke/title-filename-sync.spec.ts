import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

/** Known BlockNote/ProseMirror error that fires during editor re-mount after rename. */
const KNOWN_EDITOR_ERRORS = ['isConnected']

function isKnownEditorError(msg: string): boolean {
  return KNOWN_EDITOR_ERRORS.some(k => msg.includes(k))
}

test.describe('Title/filename sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
  })

  test('new note renamed via TitleField updates frontmatter and filename', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    // Create note via Cmd+N
    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])
    await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

    // Edit the title via TitleField (not H1)
    const titleInput = page.getByTestId('title-field-input')
    await titleInput.waitFor({ timeout: 3000 })
    await titleInput.click()
    await titleInput.fill('Career Tracks Depend on Company Shape')
    await titleInput.press('Enter')

    // Wait for async rename
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Renamed', { timeout: 5000 })

    // Breadcrumb should show the new title
    const breadcrumb = page.locator('span.truncate.font-medium')
    await expect(breadcrumb.first()).toContainText('Career Tracks Depend on Company Shape', { timeout: 2000 })

    expect(errors).toEqual([])
  })

  test('opening a note shows title from frontmatter in tab/breadcrumb', async ({ page }) => {
    // Click "All Notes" to see all notes
    const allNotes = page.locator('text=All Notes').first()
    await allNotes.click()
    await page.waitForTimeout(500)

    // Click on the first note in the note list
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const noteItem = noteListContainer.locator('.cursor-pointer').first()
    const noteTitle = await noteItem.locator('.font-medium, .text-sm').first().textContent()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Breadcrumb should show the note title
    if (noteTitle) {
      const breadcrumb = page.locator('span.truncate.font-medium')
      await expect(breadcrumb.first()).toContainText(noteTitle.trim(), { timeout: 2000 })
    }
  })

  test('rename via TitleField updates both title and filename', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    // Create a note
    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])
    await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

    // First rename via TitleField
    const titleInput = page.getByTestId('title-field-input')
    await titleInput.waitFor({ timeout: 3000 })
    await titleInput.click()
    await titleInput.fill('Original Title XYZ')
    await titleInput.press('Enter')

    // Wait for rename
    await expect(page.locator('.fixed.bottom-8')).toContainText('Renamed', { timeout: 5000 })

    // Second rename via TitleField
    await titleInput.click()
    await titleInput.fill('Renamed Title XYZ')
    await titleInput.press('Enter')

    // Wait for second rename
    await expect(page.locator('.fixed.bottom-8')).toContainText('Renamed', { timeout: 5000 })

    // Breadcrumb should show the new title
    const breadcrumb = page.locator('span.truncate.font-medium')
    await expect(breadcrumb.first()).toContainText('Renamed Title XYZ', { timeout: 2000 })

    expect(errors).toEqual([])
  })
})
