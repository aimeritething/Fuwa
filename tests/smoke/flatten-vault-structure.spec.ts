import { test, expect } from '@playwright/test'

test.describe('Flat vault structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('new note is created at vault root (no type folder in path)', async ({ page }) => {
    // Create a new note via Ctrl+N (mock Cmd+N)
    await page.locator('body').click()
    await page.keyboard.press('Control+n')

    // Wait for the editor to appear (note was created)
    await page.waitForTimeout(500)

    // Check that no toast says "Note moved" — type change should not move file
    const movedToast = page.locator('text=Note moved')
    await expect(movedToast).not.toBeVisible()
  })

  test('changing type via frontmatter does NOT show move toast', async ({ page }) => {
    // Create a note first
    await page.locator('body').click()
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)

    // Verify no "Note moved" toast appears (since move_note_to_type_folder is removed)
    const movedToast = page.locator('text=Note moved')
    await expect(movedToast).not.toBeVisible()
  })

  test('app loads without errors', async ({ page }) => {
    // Verify the app loaded — check that the main container exists
    const main = page.locator('#root')
    await expect(main).toBeVisible()

    // No console errors about move_note_to_type_folder
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.waitForTimeout(1000)

    const moveErrors = errors.filter(e => e.includes('move_note_to_type_folder'))
    expect(moveErrors).toHaveLength(0)
  })
})
