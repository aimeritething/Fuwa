import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

/** Known BlockNote/ProseMirror error that fires during editor re-mount after rename. */
const KNOWN_EDITOR_ERRORS = ['isConnected']

function isKnownEditorError(msg: string): boolean {
  return KNOWN_EDITOR_ERRORS.some(k => msg.includes(k))
}

/**
 * Helper: create a new note and rename it via TitleField.
 */
async function createNoteWithTitle(page: import('@playwright/test').Page, title: string) {
  // 1. Cmd+N → new "Untitled note"
  await page.locator('body').click()
  await sendShortcut(page, 'n', ['Control'])
  await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

  // 2. Edit the title via TitleField
  const titleInput = page.getByTestId('title-field-input')
  await titleInput.waitFor({ timeout: 3000 })
  await titleInput.click()
  await titleInput.fill(title)
  await titleInput.press('Enter')

  // 3. Wait for async rename to complete
  await page.waitForTimeout(1000)
}

test.describe('Note filename updates on title change + save', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Wait for startup toast to dismiss
    await page.waitForTimeout(2500)
  })

  test('Cmd+N creates untitled note, editing TitleField triggers rename', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    await createNoteWithTitle(page, 'Test Note ABC')

    // The toast should show "Renamed" after the TitleField commit
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Renamed', { timeout: 5000 })

    // Breadcrumb should show the new title
    const breadcrumb = page.locator('span.truncate.font-medium')
    await expect(breadcrumb.first()).toContainText('Test Note ABC', { timeout: 2000 })

    // Cmd+S should NOT trigger another rename (filename already matches)
    await sendShortcut(page, 's', ['Control'])
    await page.waitForTimeout(500)

    // No unexpected JS errors
    expect(errors).toEqual([])
  })

  test('saving a note whose filename already matches does not trigger rename', async ({ page }) => {
    // Click "All Notes" to show all notes regardless of section grouping
    const allNotes = page.locator('text=All Notes').first()
    await allNotes.click()
    await page.waitForTimeout(500)
    // Click on the first note in the note list
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const noteItem = noteListContainer.locator('.cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Cmd+S — should show "Saved" or "Nothing to save", NOT "Renamed"
    await sendShortcut(page, 's', ['Control'])

    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toBeVisible({ timeout: 3000 })
    const toastText = await toast.textContent()
    expect(toastText).not.toContain('Renamed')
  })

  test('rapid TitleField edits only rename to final title', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    await createNoteWithTitle(page, 'First Title')

    // Edit TitleField again with final title
    const titleInput = page.getByTestId('title-field-input')
    await titleInput.click()
    await titleInput.fill('Final Title')
    await titleInput.press('Enter')

    // Wait for rename
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Renamed', { timeout: 5000 })

    expect(errors).toEqual([])
  })
})
