import { test, expect } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVaultDesktopHarness, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

const SELECT_ALL_SHORTCUT = process.platform === 'darwin' ? 'Meta+A' : 'Control+A'

async function showInboxPropertyColumn(
  page: import('@playwright/test').Page,
  propertyName: string,
  visibleValue: string,
) {
  await page.getByTitle('Customize Inbox columns').click()
  const propertyCheckbox = page.getByRole('checkbox', { name: propertyName })
  await expect(propertyCheckbox).toBeVisible()
  await propertyCheckbox.click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('note-list-container').getByText(visibleValue, { exact: true })).toBeVisible()
}

async function showNoteListSearch(page: import('@playwright/test').Page) {
  const toggle = page.getByTitle('Search notes')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.getByPlaceholder('Search notes...')).toBeVisible()
}

async function searchAndOpenByKeyboard(
  page: import('@playwright/test').Page,
  query: string,
  expectedTitle: string,
  expectedFilenameStem: string,
) {
  const noteList = page.getByTestId('note-list-container')
  const searchInput = page.getByPlaceholder('Search notes...')
  await searchInput.focus()
  await page.keyboard.press(SELECT_ALL_SHORTCUT)
  await page.keyboard.type(query)
  await expect(page.getByTestId('note-list-search-loading')).toBeVisible()
  await expect(page.getByTestId('note-list-search-loading')).toHaveCount(0)
  await expect(noteList.getByText(expectedTitle, { exact: true })).toBeVisible()
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(expectedFilenameStem, { timeout: 5_000 })
}

test.describe('Note-list search visible content', () => {
  test.beforeEach(async ({ page }) => {
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.setViewportSize({ width: 1600, height: 900 })
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('keyboard note-list search matches title, snippet, and visible property values @smoke', async ({ page }) => {
    await showInboxPropertyColumn(page, 'Attendees', 'Test User')
    await showNoteListSearch(page)

    await searchAndOpenByKeyboard(page, 'Team Meeting', 'Team Meeting', 'team-meeting')
    await searchAndOpenByKeyboard(page, 'referenced by Alpha Project', 'Note B', 'note-b')
    await searchAndOpenByKeyboard(page, 'Test User', 'Team Meeting', 'team-meeting')
  })
})
