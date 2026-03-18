import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

/** Known BlockNote/ProseMirror error that fires during editor re-mount after rename. */
const KNOWN_EDITOR_ERRORS = ['isConnected']

function isKnownEditorError(msg: string): boolean {
  return KNOWN_EDITOR_ERRORS.some(k => msg.includes(k))
}

test.describe('H1 decoupled from title + non-blocking rename', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
  })

  test('editing H1 in editor does NOT update TitleField', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    // Create a new note
    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])
    await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

    // Note the initial TitleField value
    const titleInput = page.getByTestId('title-field-input')
    await titleInput.waitFor({ timeout: 3000 })
    const initialTitle = await titleInput.inputValue()

    // Type an H1 in the editor body
    const heading = page.locator('[data-content-type="heading"] h1')
    if (await heading.isVisible()) {
      await heading.click({ clickCount: 3 })
    } else {
      // Click into the editor and type an H1
      const editor = page.locator('.bn-editor')
      await editor.click()
    }
    await page.keyboard.type('My Custom H1 Heading', { delay: 15 })

    // Wait well past the old debounce time (500ms)
    await page.waitForTimeout(1500)

    // TitleField should NOT have changed from its initial value
    const titleAfterH1 = await titleInput.inputValue()
    expect(titleAfterH1).toBe(initialTitle)

    expect(errors).toEqual([])
  })

  test('TitleField rename is non-blocking (no freeze)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    // Create a new note
    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])
    await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

    // Focus the TitleField and type a new title
    const titleInput = page.getByTestId('title-field-input')
    await titleInput.waitFor({ timeout: 3000 })
    await titleInput.click()
    await titleInput.fill('Responsive Rename Test')

    // Measure time for blur (commit) — should be near-instant
    const start = Date.now()
    await titleInput.press('Enter')
    const elapsed = Date.now() - start

    // The blur/commit should complete in under 500ms (no blocking rename)
    expect(elapsed).toBeLessThan(500)

    // TitleField should show the new title optimistically
    await expect(titleInput).toHaveValue('Responsive Rename Test', { timeout: 1000 })

    // Wait for rename to complete in background
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Renamed', { timeout: 5000 })

    expect(errors).toEqual([])
  })
})
