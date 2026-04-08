import { test, expect } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('creating an untitled draft hides the legacy title section in the editor', async ({ page }) => {
  await page.locator('button[title="Create new note"]').click()

  await expect(page.getByRole('textbox').last()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('title-field-input')).toHaveCount(0)
  await expect(page.locator('.title-section[data-title-ui-visible]')).toHaveCount(0)
})
