import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette } from './helpers'
import {
  expectNoPageErrors,
  expectNormalizedEditorText,
  selectEditorTextRange,
  trackPageErrors,
} from './inlineWikilinkEditorHelpers'

async function readCaretGapAfterChip(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector('[data-testid="command-palette-ai-input"]')
    if (!(editor instanceof HTMLElement)) return null

    const chip = editor.querySelector('[data-testid="inline-wikilink-chip"]')
    if (!(chip instanceof HTMLElement)) return null

    const selection = window.getSelection()
    if (selection === null) return null
    if (selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0).cloneRange()
    range.collapse(true)

    const caretRect = range.getBoundingClientRect()
    if (caretRect.height === 0) return null

    return caretRect.left - chip.getBoundingClientRect().right
  })
}

async function expectCaretAfterChip(page: Page) {
  await expect.poll(() => readCaretGapAfterChip(page)).toBeLessThan(24)
}

test.describe('Command palette AI mode regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  })

  test('keeps focus, supports inline chip edits, and survives selection deletion', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openCommandPalette(page)
    await page.locator('input[placeholder="Type a command..."]').pressSequentially(' ')

    const aiInput = page.getByTestId('command-palette-ai-input')
    await expect(aiInput).toBeVisible()
    await expect(aiInput).toBeFocused()

    await page.keyboard.type('a')
    await expect(aiInput).toBeVisible()
    await expect(aiInput).toBeFocused()
    await expect(page.locator('input[placeholder="Type a command..."]')).toHaveCount(0)
    await expectNormalizedEditorText(aiInput, 'a')
    await page.keyboard.press('Backspace')

    await page.keyboard.type('edit my [[b')
    await expect(page.getByTestId('wikilink-menu')).toContainText('Build Laputa App')

    await page.getByTestId('wikilink-menu').getByText('Build Laputa App').click()
    await expect(aiInput.getByTestId('inline-wikilink-chip')).toContainText('Build Laputa App')
    await expectCaretAfterChip(page)

    await page.keyboard.type(' essay')
    await expectNormalizedEditorText(aiInput, 'edit my Build Laputa App essay')

    await selectEditorTextRange(page, 'command-palette-ai-input', 5)
    await page.keyboard.press('Backspace')

    await expect(aiInput).toBeVisible()
    await expectNoPageErrors(pageErrors)
  })
})
