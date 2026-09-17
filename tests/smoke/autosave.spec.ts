import { expect, test } from '@playwright/test'
import {
  MOCK_FOLDER,
  openDocumentThroughDialog,
  openWelcome,
  saveCalls,
  savedContent,
  typeAtEnd,
  watchForErrors,
  WELCOME_PATH,
} from './harness'

// Typing in Rich mode reaches the command boundary as a save_note_content
// invoke after the idle wait, and ⌘S flushes at once.

const AUTOSAVE_IDLE_MS = 1_500

test('typing triggers an Autosave invoke after the idle wait', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  await typeAtEnd(page, ' Typed in the smoke spec.')

  // Nothing is written while the keystrokes are still fresh.
  expect(await saveCalls(page)).toEqual([])

  await expect.poll(() => saveCalls(page), { timeout: AUTOSAVE_IDLE_MS + 3_000 }).toHaveLength(1)
  const [call] = await saveCalls(page)
  expect(call.args).toMatchObject({ path: WELCOME_PATH, vaultPath: MOCK_FOLDER })
  expect(String(call.args?.content)).toContain('Typed in the smoke spec.')
  expect(String(call.args?.content)).toMatch(/^# Welcome\n/)
  expect(await savedContent(page, WELCOME_PATH)).toContain('Typed in the smoke spec.')
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('⌘S writes the latest keystrokes immediately', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  await typeAtEnd(page, ' Saved by hand.')
  await page.keyboard.press('Meta+s')

  await expect.poll(() => saveCalls(page), { timeout: 1_000 }).toHaveLength(1)
  expect(await savedContent(page, WELCOME_PATH)).toContain('Saved by hand.')

  // The idle timer that was already running must not write a second copy.
  await page.waitForTimeout(AUTOSAVE_IDLE_MS + 500)
  expect(await saveCalls(page)).toHaveLength(1)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('opening a Document and saving without edits leaves the bytes untouched', async ({ page }) => {
  await openWelcome(page)
  const before = await savedContent(page, WELCOME_PATH)

  await page.keyboard.press('Meta+s')
  await page.waitForTimeout(500)

  expect(await saveCalls(page)).toEqual([])
  expect(await savedContent(page, WELCOME_PATH)).toBe(before)
})

test('a refused write is reported, keeps the buffer and leaves the file alone', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await typeAtEnd(page, ' First.')
  await page.keyboard.press('Meta+s')
  await expect.poll(() => savedContent(page, WELCOME_PATH)).toContain('First.')
  const written = await savedContent(page, WELCOME_PATH)

  await page.evaluate((path) => window.__fuwaMockVault?.markReadOnly([path]), WELCOME_PATH)
  await page.waitForTimeout(AUTOSAVE_IDLE_MS)
  await typeAtEnd(page, ' Blocked.')
  await expect.poll(() => saveCalls(page), { timeout: AUTOSAVE_IDLE_MS + 3_000 }).toHaveLength(2)

  expect(await savedContent(page, WELCOME_PATH)).toBe(written)
  expect(errors.consoleErrors.some((text) => text.includes('Could not save'))).toBe(true)

  // The buffer survived: once the path is writable again, ⌘S lands it.
  await page.evaluate(() => window.__fuwaMockVault?.markReadOnly([]))
  await page.keyboard.press('Meta+s')
  await expect.poll(() => savedContent(page, WELCOME_PATH)).toContain('Blocked.')
  expect(await savedContent(page, WELCOME_PATH)).toContain('First.')
  expect(errors.pageErrors).toEqual([])
})

test('opening another Document first writes the pending edits of the current one', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)
  await typeAtEnd(page, ' Pending.')

  // Within the idle wait, before anything has been written, switch Documents.
  expect(await saveCalls(page)).toEqual([])
  await openDocumentThroughDialog(page, `${MOCK_FOLDER}/Projects/Fuwa.md`)

  await expect(page.locator('.bn-editor h1')).toHaveText('Fuwa')
  await expect(page.getByTestId('path-row')).toContainText('Fuwa.md')
  await expect.poll(() => savedContent(page, WELCOME_PATH)).toContain('Pending.')
  const [call] = await saveCalls(page)
  expect(call.args).toMatchObject({ path: WELCOME_PATH, vaultPath: MOCK_FOLDER })
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})
