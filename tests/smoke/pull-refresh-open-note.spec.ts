import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

let tempVaultDir: string

async function openNote(page: Page, title: string) {
  const noteList = page.getByTestId('note-list-container')
  await noteList.getByText(title, { exact: true }).click()
}

async function stubUpdatedPull(page: Page, updatedFile: string) {
  await page.evaluate((filePath) => {
    window.__mockHandlers!.git_pull = () => ({
      status: 'updated',
      message: 'Pulled 1 update from remote',
      updatedFiles: [filePath],
      conflictFiles: [],
    })
  }, updatedFile)
}

async function pullFromRemote(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Pull from Remote')
}

test.describe('Pull refreshes the open note immediately', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000)
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.setViewportSize({ width: 1600, height: 900 })
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('successful pull refreshes the open editor and note list title immediately', async ({ page }) => {
    const originalTitle = 'Note B'
    const pulledTitle = `Pulled Note B ${Date.now()}`
    const pulledBody = `Pulled change ${Date.now()}`
    const notePath = path.join(tempVaultDir, 'note', 'note-b.md')

    await openNote(page, originalTitle)
    await expect(page.locator('.bn-editor h1').first()).toHaveText(originalTitle, { timeout: 5_000 })

    fs.writeFileSync(notePath, `---
Is A: Note
Status: Active
---

# ${pulledTitle}

${pulledBody}
`, 'utf8')
    await stubUpdatedPull(page, notePath)

    await pullFromRemote(page)

    await expect(page.getByText('Pulled 1 update(s) from remote')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor h1').first()).toHaveText(pulledTitle, { timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toContainText(pulledBody, { timeout: 5_000 })

    const noteList = page.getByTestId('note-list-container')
    await expect(noteList.getByText(pulledTitle, { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(noteList.getByText(originalTitle, { exact: true })).toHaveCount(0)
  })
})
