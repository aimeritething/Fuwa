import { test, expect } from '@playwright/test'
import { openCommandPalette, findCommand } from './helpers'

test.describe('Open in New Window', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('"Open in New Window" command appears in palette when note is active', async ({ page }) => {
    // Open a note first (click first item in note list)
    const firstNote = page.locator('.cursor-pointer.border-b').first()
    await expect(firstNote).toBeVisible({ timeout: 3_000 })
    await firstNote.click()

    // Wait for editor to load
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 3_000 })

    // Open command palette and search
    await openCommandPalette(page)
    const found = await findCommand(page, 'Open in New Window')
    expect(found).toBe(true)
  })

  test('"Open in New Window" shows shortcut hint', async ({ page }) => {
    // Open a note
    const firstNote = page.locator('.cursor-pointer.border-b').first()
    await expect(firstNote).toBeVisible({ timeout: 3_000 })
    await firstNote.click()
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 3_000 })

    // Open command palette and search for the command
    await openCommandPalette(page)
    const input = page.locator('input[placeholder="Type a command..."]')
    await input.fill('Open in New Window')

    // The shortcut hint should be visible
    const commandRow = page.locator('text=Open in New Window').first()
    await expect(commandRow).toBeVisible({ timeout: 2_000 })
  })
})
