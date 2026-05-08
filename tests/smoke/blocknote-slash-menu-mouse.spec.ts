import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openSlashMenuOnNewLine(page: Page) {
  await page.locator('[data-testid="note-list-container"]').getByText('Alpha Project', { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await page.locator('.bn-block-content').last().click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')

  const menu = page.locator('.bn-suggestion-menu')
  await expect(menu).toBeVisible({ timeout: 5_000 })
  return menu
}

async function openFilteredSlashMenuOnNewLine(page: Page) {
  await openSlashMenuOnNewLine(page)
  await page.keyboard.type('bul')

  const menu = page.locator('.bn-suggestion-menu')
  await expect(menu).toBeVisible({ timeout: 5_000 })
  return menu
}

test('filtered slash-menu commands can be selected with the mouse', async ({ page }) => {
  await openFilteredSlashMenuOnNewLine(page)

  await page.getByRole('option', { name: /Bullet List/i }).click()
  await page.keyboard.type('Mouse selected bullet')

  await expect(
    page.locator('.bn-block-content[data-content-type="bulletListItem"]').filter({
      hasText: 'Mouse selected bullet',
    }),
  ).toBeVisible()
  await expect(page.locator('.bn-suggestion-menu')).not.toBeVisible()
})

test('plain slash-menu mouse selection opens follow-up pickers', async ({ page }) => {
  await openSlashMenuOnNewLine(page)

  await page.getByRole('option', { name: /Emoji/i }).click()

  await expect(page.locator('.bn-grid-suggestion-menu')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('.bn-suggestion-menu')).not.toBeVisible()
})
