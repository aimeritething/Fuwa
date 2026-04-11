import { test, expect, type Page } from '@playwright/test'
import { triggerMenuCommand } from './testBridge'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

function untitledRow(page: Page, typeLabel: string) {
  return page.getByText(new RegExp(`^Untitled ${typeLabel}(?: \\d+)?$`, 'i')).first()
}

test.describe('keyboard command routing', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('native menu trigger creates a note through the shared command path @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openFixtureVault(page, tempVaultDir)
    await triggerMenuCommand(page, 'file-new-note')

    await expect(untitledRow(page, 'note')).toBeVisible({ timeout: 5_000 })
    expect(errors).toEqual([])
  })

  test('native menu trigger toggles the properties panel through the shared command path', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()

    await triggerMenuCommand(page, 'view-toggle-properties')
    await expect(page.getByTitle('Close Properties (⌘⇧I)')).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, 'view-toggle-properties')
    await expect(page.getByTitle('Properties (⌘⇧I)')).toBeVisible({ timeout: 5_000 })
  })

  test('native menu trigger toggles the AI panel through the shared command path', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()

    await triggerMenuCommand(page, 'view-toggle-ai-chat')
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTitle('Close AI panel')).toBeVisible()

    await triggerMenuCommand(page, 'view-toggle-ai-chat')
    await expect(page.getByTestId('ai-panel')).not.toBeVisible({ timeout: 5_000 })
  })
})
