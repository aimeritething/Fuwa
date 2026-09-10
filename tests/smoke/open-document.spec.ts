import { expect, test } from '@playwright/test'
// Type-only: brings the fixture's `window.__fuwaMockVault` declaration into the spec program.
import type { MockVault } from '../../src/mock-tauri/vaultFixture'
import { MOCK_FOLDER, openDocumentThroughDialog, watchForErrors, WELCOME_PATH } from './harness'

// Spec 3 of the smoke plan: File → Open Document… (⌘⇧O) renders the chosen
// Document in Rich mode inside the card. The system dialog has no browser
// equivalent, so the spec queues the "chosen" path on the Folder fixture.

test('⌘⇧O opens the chosen Document and renders it in Rich mode', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('editor-empty-state')).toBeVisible()

  await openDocumentThroughDialog(page, WELCOME_PATH)

  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible()
  await expect(editor.locator('h1')).toHaveText('Welcome')
  await expect(editor).toContainText('This Folder lives in memory.')
  await expect(page.getByTestId('path-row')).toContainText('Welcome.md')
  await expect(page.getByTestId('path-row-saved')).toHaveCount(0)
  await expect(page.getByTestId('editor-empty-state')).toHaveCount(0)

  const readCalls = await page.evaluate(() =>
    window.__fuwaMockVault?.calls.filter((call) => call.command === 'get_note_content') ?? [],
  )
  expect(readCalls).toEqual([
    { command: 'get_note_content', args: { path: WELCOME_PATH, vaultPath: MOCK_FOLDER } },
  ])
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('a cancelled dialog leaves the empty card in place', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('editor-empty-state')).toBeVisible()

  await page.keyboard.press('Meta+Shift+o')

  await expect(page.getByTestId('editor-empty-state')).toBeVisible()
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

// Acceptance: a Document using every dialect feature (spec section 3) renders
// without console errors; tldraw and Mermaid arrive as their own lazy chunks.
const DIALECT_PATH = `${MOCK_FOLDER}/Dialect.md`
const DIALECT_DOCUMENT = [
  '---',
  'title: Dialect',
  '---',
  '# Dialect',
  '',
  'Text with **bold**, `code`, ~~strike~~, ==highlight==, a [link](https://example.com) and math $E=mc^2$.',
  '',
  '- [ ] todo',
  '- [x] done',
  '',
  '> [!NOTE]',
  '> A callout.',
  '',
  '$$',
  '\\int_0^1 x^2 dx',
  '$$',
  '',
  '```mermaid',
  'graph TD; A-->B;',
  '```',
  '',
  '```ts',
  'const x: number = 1',
  '```',
  '',
  '```html height="200"',
  '<div><b>static html</b></div>',
  '```',
  '',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |',
  '',
  '[[Wiki link]] text stays as text.',
  '',
  '```tldraw id="board-1"',
  '{ "store": {}, "schema": { "schemaVersion": 2, "sequences": {} } }',
  '```',
  '',
].join('\n')

test('a Document using every dialect feature renders in Rich mode without console errors', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await page.evaluate(([path, content]) => {
    const vault: MockVault | undefined = window.__fuwaMockVault
    if (!vault) throw new Error('The Folder fixture is not installed')
    vault.writeNote(path, content)
    vault.queueDialogSelection([path])
  }, [DIALECT_PATH, DIALECT_DOCUMENT])

  await page.keyboard.press('Meta+Shift+o')

  const editor = page.locator('.bn-editor')
  await expect(editor.locator('h1')).toHaveText('Dialect')
  await expect(editor.locator('.katex').first()).toBeVisible()
  await expect(editor.locator('.tolaria-callout')).toHaveCount(1)
  await expect(editor.locator('mark.markdown-highlight')).toHaveCount(1)
  await expect(editor.locator('[data-content-type="mermaidBlock"] svg').first()).toBeVisible({ timeout: 15_000 })
  await expect(editor.locator('[data-content-type="codeBlock"]')).toHaveCount(1)
  await expect(editor.locator('[data-content-type="htmlBlock"]')).toHaveCount(1)
  await expect(editor.locator('table')).toHaveCount(1)
  await expect(editor.locator('[data-content-type="tldrawBlock"]')).toHaveCount(1)
  await expect(editor.locator('input[type="checkbox"]')).toHaveCount(2)
  // The inert wikilink spec shows the target as plain text; the brackets survive in the Markdown.
  await expect(editor).toContainText('Wiki link text stays as text.')

  // The prose column: theme.json's 680px + 2 × 56px padding on .bn-editor.
  const column = await editor.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      textWidth: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      padding: style.paddingLeft,
    }
  })
  expect(column).toEqual({ textWidth: 680, padding: '56px' })
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})
