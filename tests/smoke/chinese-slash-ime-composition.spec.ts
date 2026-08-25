import { expect, test } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('opens and runs a slash command committed by a Chinese IME', async ({ page }) => {
  await page.locator('[data-testid="note-list-container"]').getByText('Note B', {
    exact: true,
  }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })

  await page.locator('.bn-block-content').last().click()
  await page.keyboard.press('Enter')
  const paragraph = page.locator('.bn-block-content').last()

  const inserted = await paragraph.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const didInsert = document.execCommand('insertText', false, '/table')
    element.dispatchEvent(
      new CompositionEvent('compositionend', {
        bubbles: true,
        data: '/table',
      }),
    )
    return didInsert
  })

  expect(inserted).toBe(true)
  await expect(page.locator('#bn-suggestion-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.bn-block-content[data-content-type="table"]')).toBeVisible()
})
