import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }) => {
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openNote(page: Page, title: string) {
  await page.getByTestId('note-list-container').getByText(title, { exact: true }).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 5_000 })
}

test('dragging a note into the rich editor inserts a canonical wikilink', async ({ page }) => {
  await openNote(page, 'Note B')

  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 5_000 })
  await editor.locator('p').last().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')

  const draggedNotePath = path.join(tempVaultDir, 'project', 'alpha-project.md')
  await page.getByTestId(`draggable-note:${draggedNotePath}`).dragTo(editor)

  await expect(editor.locator('.wikilink[data-target="project/alpha-project"]')).toBeVisible({ timeout: 5_000 })
})
