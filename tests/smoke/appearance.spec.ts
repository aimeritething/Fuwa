import { expect, test, type Page } from '@playwright/test'
// Type-only: brings the fixture's `window.__fuwaMockVault` declaration into the spec program.
import type { MockVault } from '../../src/platform/mock/vaultFixture'
import { MOCK_FOLDER, openDocumentThroughDialog, openWelcome, watchForErrors } from './harness'

// Dark on first launch, View → Appearance switches and the choice lives in
// the Session; `system` follows the OS live. The native menu is the
// Rust side's; here the manifest command arrives as the app-command event the
// renderer also listens for, and is dispatched to the same handler.

const APP_COMMAND_EVENT_NAME = 'fuwa:dispatch-command' // hooks/appCommandDispatcher.ts

const storedSession = (page: Page) => page.evaluate(() => window.__fuwaMockVault?.invoke('read_session'))
const documentTheme = (page: Page) => page.locator('html').getAttribute('data-theme')

async function chooseAppearance(page: Page, mode: 'system' | 'dark' | 'light') {
  await page.evaluate(
    ([eventName, id]) => window.dispatchEvent(new CustomEvent(eventName, { detail: id })),
    [APP_COMMAND_EVENT_NAME, `view-appearance-${mode}`] as const,
  )
}

const SAMPLE_PATH = `${MOCK_FOLDER}/Sample.md`
const SAMPLE = [
  '# Title', '', 'Body with `inline code`.', '', '## Section', '', '- [ ] Task', '', '> Quote', '',
  '```ts', 'const a = 1', '```', '', '| A | B |', '| --- | --- |', '| 1 | 2 |', '', '---', '',
].join('\n')

/** Plant a Document that uses every block the ticket measures, and open it. */
async function openSample(page: Page) {
  await page.goto('/')
  await page.evaluate(([path, content]) => {
    const vault: MockVault | undefined = window.__fuwaMockVault
    if (!vault) throw new Error('The Folder fixture is not installed')
    vault.writeNote(path, content)
  }, [SAMPLE_PATH, SAMPLE] as const)
  await openDocumentThroughDialog(page, SAMPLE_PATH)
  await expect(page.locator('.bn-editor h1')).toHaveText('Title')
}

test('first launch is dark: the canvas, the card and the body text sample to the Linear values', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.keyboard.press('Meta+BracketLeft') // a lone Document collapsed the sidebar
  await expect(page.getByTestId('sidebar')).toHaveCSS('color', 'rgb(148, 149, 151)')
  await expect(page.locator('.fuwa-shell')).toHaveCSS('background-color', 'rgb(9, 9, 10)')
  await expect(page.getByTestId('editor-card')).toHaveCSS('background-color', 'rgb(17, 18, 18)')
  await expect(page.locator('.bn-editor')).toHaveCSS('color', 'rgb(226, 227, 229)')
  await expect(page.locator('.bn-editor h1')).toHaveCSS('color', 'rgb(255, 255, 255)')
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('a sample Document measures at the specified typography', async ({ page }) => {
  const errors = watchForErrors(page)
  await openSample(page)
  const editor = page.locator('.bn-editor')

  await expect(editor).toHaveCSS('font-size', '15px')
  await expect(editor).toHaveCSS('line-height', '24px')
  await expect(editor).toHaveCSS('font-weight', '450')
  await expect(editor.locator('h1')).toHaveCSS('font-size', '22px')
  await expect(editor.locator('h1')).toHaveCSS('line-height', '29.6px')
  await expect(editor.locator('h2')).toHaveCSS('font-size', '19px')
  await expect(editor.locator('h2')).toHaveCSS('line-height', '28px')
  await expect(editor.locator('h2')).toHaveCSS('font-weight', '600')
  await expect(editor.locator('.bn-inline-content code').first()).toHaveCSS('font-size', '14.0625px')
  await expect(editor.locator('[data-content-type="codeBlock"]')).toHaveCSS('font-size', '13px')
  await expect(editor.locator('[data-content-type="codeBlock"]')).toHaveCSS('background-color', 'rgb(9, 9, 10)')
  await expect(editor.locator('[data-content-type="codeBlock"]')).toHaveCSS('border-top-left-radius', '6px')
  await expect(editor.locator('blockquote').first()).toHaveCSS('border-left-width', '4px')
  await expect(editor.locator('input[type="checkbox"]').first()).toHaveCSS('width', '14px')
  await expect(editor.locator('input[type="checkbox"]').first()).toHaveCSS('border-top-width', '1px')
  await expect(editor.locator('th').first()).toHaveCSS('background-color', 'rgb(21, 22, 23)')
  await expect(editor.locator('hr')).toHaveCSS('border-top-width', '1px')
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('View → Appearance → Light switches the document, persists in the Session and survives a relaunch', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  await chooseAppearance(page, 'light')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('.fuwa-shell')).toHaveCSS('background-color', 'rgb(238, 238, 239)')
  await expect(page.getByTestId('editor-card')).toHaveCSS('background-color', 'rgb(248, 248, 249)')
  await expect(page.locator('.bn-editor')).toHaveCSS('color', 'rgb(47, 47, 49)')
  await expect.poll(() => storedSession(page)).toMatchObject({ version: 1, theme: 'light' })

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('.bn-editor h1')).toHaveText('Welcome')
  await expect.poll(() => storedSession(page)).toMatchObject({ theme: 'light' })

  await chooseAppearance(page, 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => storedSession(page)).toMatchObject({ theme: 'dark' })
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('System follows a live OS appearance change and is what the Session remembers', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await openWelcome(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await chooseAppearance(page, 'system')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(() => storedSession(page)).toMatchObject({ theme: 'system' })

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  expect(await documentTheme(page)).toBe('dark')
  await expect.poll(() => storedSession(page)).toMatchObject({ theme: 'system' })
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('only Inter Variable and JetBrains Mono are fetched', async ({ page }) => {
  const fontRequests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fontRequests.push(request.url())
  })
  await openWelcome(page)
  await page.evaluate(() => document.fonts.ready)

  expect(fontRequests.length).toBeGreaterThan(0)
  for (const url of fontRequests) expect(url).toMatch(/inter|jetbrains-mono/i)
  expect(fontRequests.some((url) => /plex|mantine/i.test(url))).toBe(false)
})
