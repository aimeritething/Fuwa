import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

async function openAlphaProject(page: Page) {
  await openFixtureVault(page, tempVaultDir)
  await page.getByText('Alpha Project', { exact: true }).first().click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 10_000 })
}

test.describe('BlockNote slash menu styling', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('slash menu keeps Mantine styling tokens in the editor', async ({ page }) => {
    await openAlphaProject(page)

    await page.locator('.bn-editor').click()
    await page.keyboard.type('/')

    const menu = page.locator('.bn-suggestion-menu')
    await expect(menu).toBeVisible({ timeout: 5_000 })

    const menuStyles = await menu.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        spacing: style.getPropertyValue('--mantine-spacing-sm').trim(),
        radius: style.getPropertyValue('--mantine-radius-default').trim(),
        shadow: style.getPropertyValue('--mantine-shadow-md').trim(),
      }
    })

    expect(menuStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(menuStyles.borderRadius).not.toBe('0px')
    expect(menuStyles.boxShadow).not.toBe('none')
    expect(menuStyles.spacing).not.toBe('')
    expect(menuStyles.radius).not.toBe('')
    expect(menuStyles.shadow).not.toBe('')
  })
})
