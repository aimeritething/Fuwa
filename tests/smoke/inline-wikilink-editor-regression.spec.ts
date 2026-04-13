import { test, expect } from '@playwright/test'
import {
  expectNoPageErrors,
  expectNormalizedEditorText,
  selectEditorTextRange,
  trackPageErrors,
} from './inlineWikilinkEditorHelpers'

test.describe('Inline wikilink editor regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })

    await page.locator('.app__note-list .cursor-pointer').first().click()
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 3_000 })
    await page.getByTitle('Open AI Chat').click()
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3_000 })
  })

  test('keeps inline chip editing stable after insertion and range deletion', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    const editor = page.getByTestId('agent-input')
    await expect(editor).toBeFocused()

    await page.keyboard.type('edit my [[b')
    await expect(page.getByTestId('wikilink-menu')).toContainText('Build Laputa App')

    await page.getByTestId('wikilink-menu').getByText('Build Laputa App').click()
    await expect(editor.getByTestId('inline-wikilink-chip')).toContainText('Build Laputa App')

    await page.keyboard.type(' essay')
    await expectNormalizedEditorText(editor, 'edit my Build Laputa App essay')

    await selectEditorTextRange(page, 'agent-input', 5)
    await page.keyboard.press('Backspace')

    await expect(editor).toBeVisible()
    await expectNoPageErrors(pageErrors)
  })
})
