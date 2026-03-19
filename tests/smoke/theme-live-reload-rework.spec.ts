import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

async function getCssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => document.documentElement.style.getPropertyValue(n),
    name,
  )
}

/** Replace all text in the CodeMirror editor via the exposed __cmView. */
async function setCmContent(page: Page, newContent: string) {
  await page.evaluate((text) => {
    const container = document.querySelector('[data-testid="raw-editor-codemirror"]')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (container as any)?.__cmView
    if (!view) throw new Error('No __cmView on raw-editor-codemirror container')
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    })
  }, newContent)
}

test.describe('Theme live reload on raw editor save (rework)', () => {
  test.beforeEach(async ({ page }) => {
    // Block vault API so the app uses mock handlers
    await page.route('**/api/vault/ping', (route) =>
      route.fulfill({ status: 404, body: 'blocked for testing' }),
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('editing theme frontmatter in raw mode and saving updates CSS vars', async ({ page }) => {
    // 1. Switch to the default theme
    await openCommandPalette(page)
    await executeCommand(page, 'Switch to Default Theme')
    await expect(async () => {
      expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
    }).toPass({ timeout: 5000 })

    // 2. Open the theme note in the editor
    await openCommandPalette(page)
    await executeCommand(page, 'Edit Default Theme')
    await page.waitForTimeout(500)

    // 3. Switch to raw editor mode
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw Editor')
    await expect(page.locator('.cm-content')).toBeVisible({ timeout: 3000 })

    // 4. Replace content with a changed background color
    const updatedContent = [
      '---',
      'type: Theme',
      'Description: Light theme with warm, paper-like tones',
      'background: "#FFD700"',
      'foreground: "#37352F"',
      'primary: "#155DFF"',
      'sidebar: "#F7F6F3"',
      'text-primary: "#37352F"',
      'lists-bullet-size: 32px',
      'lists-bullet-color: "#FF0000"',
      '---',
      '',
      '# Default',
      '',
      'Light theme with warm, paper-like tones.',
    ].join('\n')
    await setCmContent(page, updatedContent)

    // Wait for debounce to flush (RawEditorView has 500ms debounce)
    await page.waitForTimeout(700)

    // 5. Save with Ctrl+S (works on all platforms in browser mode)
    await page.keyboard.press('Control+s')

    // 6. Verify CSS vars updated live
    await expect(async () => {
      expect(await getCssVar(page, '--background')).toBe('#FFD700')
    }).toPass({ timeout: 5000 })

    // Verify other vars also updated
    expect(await getCssVar(page, '--sidebar')).toBe('#F7F6F3')
    expect(await getCssVar(page, '--foreground')).toBe('#37352F')

    // Verify bullet-size and bullet-color (rework regression)
    expect(await getCssVar(page, '--lists-bullet-size')).toBe('32px')
    expect(await getCssVar(page, '--lists-bullet-color')).toBe('#FF0000')
  })

  test('saving a non-theme note does not affect active theme CSS', async ({ page }) => {
    // 1. Switch to the default theme
    await openCommandPalette(page)
    await executeCommand(page, 'Switch to Default Theme')
    await expect(async () => {
      expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
    }).toPass({ timeout: 5000 })

    // 2. Open a regular note (first in the note list)
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5000 })
    await noteList.locator('.cursor-pointer').first().click()
    await page.waitForTimeout(300)

    // 3. Switch to raw editor mode
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw Editor')
    await expect(page.locator('.cm-content')).toBeVisible({ timeout: 3000 })

    // 4. Type something and save
    await page.locator('.cm-content').click()
    await page.keyboard.type('test edit ')
    await page.waitForTimeout(600)
    await page.keyboard.press('Control+s')
    await page.waitForTimeout(500)

    // 5. Theme CSS vars should be unchanged
    expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
  })
})
