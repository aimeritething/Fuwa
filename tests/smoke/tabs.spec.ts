import { expect, test, type Page } from '@playwright/test'
import { MOCK_FOLDER, openDocumentThroughDialog, watchForErrors, WELCOME_PATH } from './harness'

// Several Documents open as Tabs and Open Editors rows, the successor rule on
// close, positional navigation and ⌘W. With no Folder open every Tab is
// out-of-Folder, so each row carries its dimmed parent after the name; the
// name assertions here read the name span rather than the whole row. Opening
// a Document with no Folder collapses the sidebar, so the rows are read after
// ⌘[ brings it back.

const READING_LIST_PATH = `${MOCK_FOLDER}/Reading list.md`
const FUWA_PATH = `${MOCK_FOLDER}/Projects/Fuwa.md`

const tabNames = (page: Page) => page.getByRole('tab').allTextContents()
const rowNames = (page: Page) => page.getByRole('option').locator('.fuwa-sidebar-row__name').allTextContents()
const rowParents = (page: Page) => page.getByRole('option').locator('.fuwa-sidebar-row__parent').allTextContents()
const activeTab = (page: Page) => page.getByRole('tab', { selected: true })
const activeRow = (page: Page) => page.getByRole('option', { selected: true }).locator('.fuwa-sidebar-row__name')

async function openThree(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('open-editors')).toHaveCount(0)
  await openDocumentThroughDialog(page, WELCOME_PATH)
  await openDocumentThroughDialog(page, READING_LIST_PATH)
  await openDocumentThroughDialog(page, FUWA_PATH)
  await expect(page.locator('.bn-editor h1')).toHaveText('Fuwa')
  await page.keyboard.press('Meta+BracketLeft')
  await expect(page.getByTestId('sidebar')).toBeVisible()
}

test('three Documents give three Tabs and three Open Editors rows, with the active pair matching', async ({ page }) => {
  const errors = watchForErrors(page)
  await openThree(page)

  expect(await tabNames(page)).toEqual(['Welcome.md', 'Reading list.md', 'Fuwa.md'])
  expect(await rowNames(page)).toEqual(['Welcome.md', 'Reading list.md', 'Fuwa.md'])
  expect(await rowParents(page)).toEqual(['Notes', 'Notes', 'Projects'])
  await expect(activeTab(page)).toHaveText('Fuwa.md')
  await expect(activeRow(page)).toHaveText('Fuwa.md')
  await expect(page.getByTestId('tab-bar')).toHaveCSS('height', '44px')
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('opening an already-open Document activates its Tab instead of adding one', async ({ page }) => {
  await openThree(page)

  await openDocumentThroughDialog(page, WELCOME_PATH)

  await expect(activeTab(page)).toHaveText('Welcome.md')
  await expect(page.locator('.bn-editor h1')).toHaveText('Welcome')
  expect(await tabNames(page)).toEqual(['Welcome.md', 'Reading list.md', 'Fuwa.md'])
})

test('closing the middle Tab activates the one to its right, closing the last the one to its left', async ({ page }) => {
  await openThree(page)

  await page.getByRole('tab', { name: 'Reading list.md' }).click()
  await expect(activeTab(page)).toHaveText('Reading list.md')
  await page.getByRole('tab', { name: 'Reading list.md' }).hover()
  await page.getByRole('tab', { name: 'Reading list.md' }).getByRole('button', { name: 'Close Reading list.md' }).click()

  expect(await tabNames(page)).toEqual(['Welcome.md', 'Fuwa.md'])
  await expect(activeTab(page)).toHaveText('Fuwa.md')
  await expect(page.locator('.bn-editor h1')).toHaveText('Fuwa')

  await page.getByRole('option', { name: 'Fuwa.md' }).hover()
  await page.getByRole('option', { name: 'Fuwa.md' }).getByRole('button', { name: 'Close Fuwa.md' }).click()

  expect(await tabNames(page)).toEqual(['Welcome.md'])
  await expect(activeTab(page)).toHaveText('Welcome.md')
  await expect(activeRow(page)).toHaveText('Welcome.md')
})

test('⌘⇧[ and ⌘⇧] cycle positionally and ⌘2 activates the second Tab', async ({ page }) => {
  await openThree(page)

  await page.keyboard.press('Meta+Shift+[')
  await expect(activeTab(page)).toHaveText('Reading list.md')
  await page.keyboard.press('Meta+Shift+[')
  await expect(activeTab(page)).toHaveText('Welcome.md')
  await page.keyboard.press('Meta+Shift+[')
  await expect(activeTab(page)).toHaveText('Fuwa.md')

  await page.keyboard.press('Meta+Shift+]')
  await expect(activeTab(page)).toHaveText('Welcome.md')

  await page.keyboard.press('Meta+2')
  await expect(activeTab(page)).toHaveText('Reading list.md')
  await expect(activeRow(page)).toHaveText('Reading list.md')
  await expect(page.locator('.bn-editor h1')).toHaveText('Reading list')
})

test('⌘W closes the active Tab, and at zero Tabs the tab bar and Open Editors leave the DOM', async ({ page }) => {
  const errors = watchForErrors(page)
  await openThree(page)

  await page.keyboard.press('Meta+w')
  expect(await tabNames(page)).toEqual(['Welcome.md', 'Reading list.md'])
  await expect(activeTab(page)).toHaveText('Reading list.md')

  await page.keyboard.press('Meta+w')
  await page.keyboard.press('Meta+w')

  await expect(page.getByTestId('tab-bar')).toHaveCount(0)
  await expect(page.getByTestId('open-editors')).toHaveCount(0)
  await expect(page.getByTestId('editor-empty-state')).toBeVisible()

  // One more ⌘W would close the window in Tauri; here there is none to close.
  await page.keyboard.press('Meta+w')
  await expect(page.getByTestId('editor-empty-state')).toBeVisible()
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})
