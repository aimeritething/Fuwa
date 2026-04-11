import { test, expect } from '@playwright/test'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  dispatchShortcutEvent,
  triggerMenuCommand,
  triggerShortcutCommand,
} from './testBridge'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

let tempVaultDir: string

test.describe('keyboard command routing', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('desktop menu-command bridge creates a note through the shared command path @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await triggerMenuCommand(page, APP_COMMAND_IDS.fileNewNote)

    await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, { timeout: 5_000 })
    expect(errors).toEqual([])
  })

  test('desktop menu-command bridge toggles the properties panel through the shared command path @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleProperties)
    await expect(page.getByTitle('Close Properties (⌘⇧I)')).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleProperties)
    await expect(page.getByTitle('Properties (⌘⇧I)')).toBeVisible({ timeout: 5_000 })
  })

  test('desktop menu-command bridge toggles organized state through the shared command path @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await expect(page.getByTitle('Mark as organized (remove from Inbox) (Cmd+E)')).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, APP_COMMAND_IDS.noteToggleOrganized)
    await expect(page.getByTitle('Mark as unorganized (back to Inbox) (Cmd+E)')).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, APP_COMMAND_IDS.noteToggleOrganized)
    await expect(page.getByTitle('Mark as organized (remove from Inbox) (Cmd+E)')).toBeVisible({ timeout: 5_000 })
  })

  test('renderer shortcut bridge toggles the raw editor through the shared keyboard handler @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })

    await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
    await expect(page.getByTestId('raw-editor-codemirror')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  })

  test('desktop menu-command bridge toggles the AI panel, while the wrong modifier event does not @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await dispatchShortcutEvent(page, {
      key: 'l',
      code: 'KeyL',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      bubbles: true,
      cancelable: true,
    })
    await page.waitForTimeout(200)
    await expect(page.getByTestId('ai-panel')).not.toBeVisible()

    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleAiChat)
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTitle('Close AI panel')).toBeVisible()

    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleAiChat)
    await expect(page.getByTestId('ai-panel')).not.toBeVisible({ timeout: 5_000 })
  })
})
