import { expect, test } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

const FIND_SHORTCUT = process.platform === 'darwin' ? 'Meta+F' : 'Control+F'

let tempVaultDir: string

test.describe('Note-list search keyboard toggle', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000)
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.setViewportSize({ width: 1600, height: 900 })
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('Cmd+F toggles note-list search and debounces filtering @smoke', async ({ page }) => {
    const noteList = page.getByTestId('note-list-container')

    await noteList.focus()
    await page.keyboard.press(FIND_SHORTCUT)

    const searchInput = page.getByPlaceholder('Search notes...')
    await expect(searchInput).toBeFocused()

    await page.keyboard.type('Team')
    await expect(page.getByTestId('note-list-search-loading')).toBeVisible()
    await expect(noteList.getByText('Team Meeting', { exact: true })).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press(FIND_SHORTCUT)
    await expect(searchInput).toHaveCount(0)
    await expect(noteList).toBeFocused()
  })
})
