import { expect, test, type Page } from '@playwright/test'
// Type-only: brings the fixture's `window.__fuwaMockVault` declaration into the spec program.
import type { MockVault, MockVaultCall } from '../../src/mock-tauri/vaultFixture'

// Spec 4 of the smoke plan: typing in Rich mode reaches the command boundary
// as a save_note_content invoke after the idle wait, and ⌘S flushes at once.

const WELCOME_PATH = '/Users/fuwa/Documents/Notes/Welcome.md'
const AUTOSAVE_IDLE_MS = 1_500

function watchForErrors(page: Page) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) consoleErrors.push(message.text())
  })
  return { pageErrors, consoleErrors }
}

async function openWelcome(page: Page) {
  await page.goto('/')
  await page.evaluate((selected) => {
    const vault: MockVault | undefined = window.__fuwaMockVault
    if (!vault) throw new Error('The Folder fixture is not installed')
    vault.queueDialogSelection([selected])
  }, WELCOME_PATH)
  await page.keyboard.press('Meta+Shift+o')
  await expect(page.locator('.bn-editor h1')).toHaveText('Welcome')
}

function saveCalls(page: Page): Promise<MockVaultCall[]> {
  return page.evaluate(() => window.__fuwaMockVault?.calls.filter((call) => call.command === 'save_note_content') ?? [])
}

function savedContent(page: Page): Promise<string | undefined> {
  return page.evaluate((path) => window.__fuwaMockVault?.files().find((file) => file.path === path)?.content, WELCOME_PATH)
}

test('typing triggers an Autosave invoke after the idle wait, and the path row reads saved', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  const lastParagraph = page.locator('.bn-editor p').last()
  await lastParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Typed in the smoke spec.')

  // Nothing is written while the keystrokes are still fresh.
  expect(await saveCalls(page)).toEqual([])

  await expect.poll(() => saveCalls(page), { timeout: AUTOSAVE_IDLE_MS + 3_000 }).toHaveLength(1)
  const [call] = await saveCalls(page)
  expect(call.args).toMatchObject({ path: WELCOME_PATH, vaultPath: '/Users/fuwa/Documents/Notes' })
  expect(String(call.args?.content)).toContain('Typed in the smoke spec.')
  expect(String(call.args?.content)).toMatch(/^# Welcome\n/)
  expect(await savedContent(page)).toContain('Typed in the smoke spec.')
  await expect(page.getByTestId('path-row-saved')).toHaveText(/^saved /)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('⌘S writes the latest keystrokes immediately', async ({ page }) => {
  const errors = watchForErrors(page)
  await openWelcome(page)

  const lastParagraph = page.locator('.bn-editor p').last()
  await lastParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Saved by hand.')
  await page.keyboard.press('Meta+s')

  await expect.poll(() => saveCalls(page), { timeout: 1_000 }).toHaveLength(1)
  expect(await savedContent(page)).toContain('Saved by hand.')
  await expect(page.getByTestId('path-row-saved')).toHaveText(/^saved /)

  // The idle timer that was already running must not write a second copy.
  await page.waitForTimeout(AUTOSAVE_IDLE_MS + 500)
  expect(await saveCalls(page)).toHaveLength(1)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('opening a Document and saving without edits leaves the bytes untouched', async ({ page }) => {
  await openWelcome(page)
  const before = await savedContent(page)

  await page.keyboard.press('Meta+s')
  await page.waitForTimeout(500)

  expect(await saveCalls(page)).toEqual([])
  expect(await savedContent(page)).toBe(before)
})
