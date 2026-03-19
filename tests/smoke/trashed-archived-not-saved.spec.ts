import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

test.describe('Trash/archive notes appear in Changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('trashing a note increments the Changes badge', async ({ page }) => {
    const sidebar = page.locator('.app__sidebar')

    // Wait for Changes nav item in the secondary bottom area (mock starts with 3 modified files)
    const secondaryArea = sidebar.locator('[data-testid="sidebar-secondary"]')
    const changesRow = secondaryArea.locator('div', { hasText: /^Changes/ }).first()
    await changesRow.waitFor({ timeout: 5000 })

    // Read the initial badge count from the Changes row
    const badge = changesRow.locator('span').last()
    const initialCount = Number(await badge.textContent())
    expect(initialCount).toBeGreaterThan(0)

    // Click the first note in the list to select it
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    // Click on the first visible note item (border-b items inside the list)
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()

    // Trash the active note via command palette
    await openCommandPalette(page)
    await executeCommand(page, 'Trash Note')

    // Wait for the badge count to increase
    await expect(async () => {
      const text = await badge.textContent()
      expect(Number(text)).toBeGreaterThan(initialCount)
    }).toPass({ timeout: 5000 })
  })
})
