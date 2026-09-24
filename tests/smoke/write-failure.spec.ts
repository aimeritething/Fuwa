import { expect, test, type Page } from '@playwright/test'
// Type-only: brings the browser menu bridge's `window.__plumoTest` declaration into the spec program.
import type {} from '../../src/shell/use-menu-events'
import {
  MOCK_FOLDER,
  openDocumentThroughDialog,
  openWelcome,
  savedContent,
  typeAtEnd,
  watchForErrors,
  WELCOME_PATH,
} from './harness'

// The only prompt in the app. A refused
// write keeps the Tab open with the error bar (Retry / Discard changes),
// closing that Tab asks the same, and ⌘Q writes every pending edit first and
// asks, with Discard and quit, when one is refused. The fixture's
// markReadOnly stands in for a read-only file; ⌘Q reaches the renderer as the
// app-quit menu command, which the browser bridge dispatches here.

const AUTOSAVE_IDLE_MS = 1_500
const PLUMO_PATH = `${MOCK_FOLDER}/Projects/Plumo.md`

const errorBar = (page: Page) => page.getByTestId('write-failure-bar')
const dialog = (page: Page) => page.getByRole('dialog')
const buttonNames = (scope: ReturnType<Page['getByRole']>) => scope.getByRole('button').allTextContents()

const quitCalls = (page: Page) =>
  page.evaluate(() => window.__plumoMockVault?.calls.filter((call) => call.command === 'quit_app').length ?? 0)

const storedSession = (page: Page) => page.evaluate(() => window.__plumoMockVault?.invoke('read_session'))

async function pressQuit(page: Page) {
  await page.evaluate(() => window.__plumoTest?.dispatchBrowserMenuCommand?.('app-quit'))
}

/** Land one edit, make the Document read-only, then type again so the next write is refused. */
async function editThenRefuse(page: Page, path: string) {
  await typeAtEnd(page, ' First.')
  await page.keyboard.press('Meta+s')
  await expect.poll(() => savedContent(page, path)).toContain('First.')
  await page.evaluate((target) => window.__plumoMockVault?.markReadOnly([target]), path)
  await page.waitForTimeout(AUTOSAVE_IDLE_MS)
  await typeAtEnd(page, ' Blocked.')
  await expect(errorBar(page)).toBeVisible({ timeout: AUTOSAVE_IDLE_MS + 3_000 })
}

test('a refused Autosave shows the error bar with the path and two buttons, and the buffer keeps the edit', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  await editThenRefuse(page, WELCOME_PATH)
  const written = await savedContent(page, WELCOME_PATH)

  await expect(errorBar(page)).toContainText(`Couldn't save to ${WELCOME_PATH}`)
  await expect(errorBar(page)).toContainText('Permission denied')
  expect(await buttonNames(errorBar(page))).toEqual(['Retry', 'Discard changes'])
  // Straight under the tab bar, above the Document.
  const tabBarBox = (await page.getByTestId('tab-bar').boundingBox())!
  const barBox = (await errorBar(page).boundingBox())!
  expect(barBox.y).toBeGreaterThanOrEqual(tabBarBox.y + tabBarBox.height)
  expect(barBox.y + barBox.height).toBeLessThanOrEqual((await page.locator('.bn-editor h1').boundingBox())!.y)
  await expect(page.locator('.bn-editor')).toContainText('Blocked.')
  expect(written).toContain('First.')
  expect(written).not.toContain('Blocked.')
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors.every((text) => text.includes('Could not save'))).toBe(true)
})

test('Retry writes the file once it is writable again and the bar disappears', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await editThenRefuse(page, WELCOME_PATH)

  // Refused again: the bar stays.
  await errorBar(page).getByRole('button', { name: 'Retry' }).click()
  await expect(errorBar(page)).toBeVisible()
  expect(await savedContent(page, WELCOME_PATH)).not.toContain('Blocked.')

  await page.evaluate(() => window.__plumoMockVault?.markReadOnly([]))
  await errorBar(page).getByRole('button', { name: 'Retry' }).click()

  await expect(errorBar(page)).toHaveCount(0)
  expect(await savedContent(page, WELCOME_PATH)).toContain('First.')
  expect(await savedContent(page, WELCOME_PATH)).toContain('Blocked.')
  expect(errors.pageErrors).toEqual([])
})

test('Discard changes puts the disk bytes back in the editor and the bar disappears', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await editThenRefuse(page, WELCOME_PATH)
  const written = await savedContent(page, WELCOME_PATH)

  await errorBar(page).getByRole('button', { name: 'Discard changes' }).click()

  await expect(errorBar(page)).toHaveCount(0)
  await expect(page.locator('.bn-editor')).not.toContainText('Blocked.')
  await expect(page.locator('.bn-editor')).toContainText('First.')
  expect(await savedContent(page, WELCOME_PATH)).toBe(written)

  // Nothing pending is left behind: the idle timer writes nothing, and a
  // later edit is refused afresh rather than resurrecting the discarded one.
  await page.waitForTimeout(AUTOSAVE_IDLE_MS + 500)
  expect(await savedContent(page, WELCOME_PATH)).toBe(written)
  await expect(errorBar(page)).toHaveCount(0)
  expect(errors.pageErrors).toEqual([])
})

test('⌘W on a Tab with a refused write asks Retry / Discard changes, and Discard closes the Tab', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await editThenRefuse(page, WELCOME_PATH)
  const written = await savedContent(page, WELCOME_PATH)

  await page.keyboard.press('Meta+w')

  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText(`Couldn't save to ${WELCOME_PATH}`)
  expect(await buttonNames(dialog(page))).toEqual(['Retry', 'Discard changes'])
  // The modal hides the rest of the page from the accessibility tree; the Tab is still there.
  await expect(page.getByTestId('tab-bar')).toHaveCount(1)

  await dialog(page).getByRole('button', { name: 'Discard changes' }).click()

  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByTestId('tab-bar')).toHaveCount(0)
  await expect(page.getByTestId('editor-empty-state')).toBeVisible()
  expect(await savedContent(page, WELCOME_PATH)).toBe(written)
  expect(await quitCalls(page)).toBe(0)
  expect(errors.pageErrors).toEqual([])
})

test('⌘Q writes the clean Document, asks about the refused one, and Discard and quit exits with the Session written', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await editThenRefuse(page, WELCOME_PATH)

  // A second, clean Document with edits younger than the idle wait.
  await openDocumentThroughDialog(page, PLUMO_PATH)
  await expect(page.locator('.bn-editor h1')).toHaveText('Plumo')
  await expect(errorBar(page)).toHaveCount(0)
  await typeAtEnd(page, ' Pending at quit.')
  await pressQuit(page)

  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText(`Couldn't save to ${WELCOME_PATH}`)
  expect(await buttonNames(dialog(page))).toEqual(['Retry', 'Discard changes', 'Discard and quit'])
  expect(await savedContent(page, PLUMO_PATH)).toContain('Pending at quit.')
  expect(await savedContent(page, WELCOME_PATH)).not.toContain('Blocked.')
  expect(await quitCalls(page)).toBe(0)

  await dialog(page).getByRole('button', { name: 'Discard and quit' }).click()

  await expect.poll(() => quitCalls(page)).toBe(1)
  await expect(dialog(page)).toHaveCount(0)
  expect(await storedSession(page)).toMatchObject({
    openEditors: [{ path: WELCOME_PATH, mode: 'rich' }, { path: PLUMO_PATH, mode: 'rich' }],
    activePath: PLUMO_PATH,
  })
  expect(errors.pageErrors).toEqual([])
})

test('⌘Q with every write landing quits without a prompt and the disk matches the buffer', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await typeAtEnd(page, ' Written at quit.')

  await pressQuit(page)

  await expect.poll(() => quitCalls(page)).toBe(1)
  await expect(dialog(page)).toHaveCount(0)
  expect(await savedContent(page, WELCOME_PATH)).toContain('Written at quit.')
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})
