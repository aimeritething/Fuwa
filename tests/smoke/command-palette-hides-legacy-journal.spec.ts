import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { openCommandPalette } from './helpers'

let tempVaultDir: string

function seedLegacyJournalVault(vaultPath: string): void {
  fs.writeFileSync(path.join(vaultPath, 'journal.md'), `---
type: Type
order: 12
icon: book-bookmark
color: yellow
---

# Journal
`)

  fs.writeFileSync(path.join(vaultPath, 'daily-log.md'), `---
title: Daily Log
type: Journal
---

# Daily Log
`)
}

test.describe('command palette hides the legacy Journal type', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
    seedLegacyJournalVault(tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('legacy Journal does not appear in the sidebar or command palette', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)

    await expect(page.locator('nav').getByText('Journals', { exact: true })).toHaveCount(0)

    await openCommandPalette(page)
    await page.locator('input[placeholder="Type a command..."]').fill('journal')

    await expect(page.getByText('No matching commands', { exact: true })).toBeVisible()
    await expect(page.locator('div.mx-1.flex.cursor-pointer')).toHaveCount(0)
  })
})
