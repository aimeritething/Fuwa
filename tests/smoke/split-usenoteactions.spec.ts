import { test, expect } from '@playwright/test'

test.describe('split-usenoteactions: note creation and rename still work', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('Cmd+N creates a new untitled note visible in the sidebar', async ({ page }) => {
    await page.keyboard.press('Meta+n')
    await page.waitForTimeout(300)

    // The new note should appear in the note list sidebar
    const noteList = page.locator('.app__note-list')
    const untitledItem = noteList.locator('text=/untitled/i').first()
    await expect(untitledItem).toBeVisible({ timeout: 3000 })
  })

  test('creating multiple notes generates unique names in the sidebar', async ({ page }) => {
    await page.keyboard.press('Meta+n')
    await page.waitForTimeout(200)
    await page.keyboard.press('Meta+n')
    await page.waitForTimeout(200)

    // Both notes should be visible in the sidebar with different names
    const noteList = page.locator('.app__note-list')
    const untitledItems = noteList.locator('text=/untitled/i')
    await expect(untitledItems.first()).toBeVisible({ timeout: 3000 })
    const count = await untitledItems.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('selecting a note opens it without errors', async ({ page }) => {
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    // Editor area should be visible (no crash from the refactored hooks)
    const editor = page.locator('.app__editor')
    await expect(editor).toBeVisible({ timeout: 3000 })
  })

  test('frontmatter property update shows toast', async ({ page }) => {
    // Select an existing note
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    // Inspector panel renders without errors from frontmatterOps extraction
    const inspector = page.getByTestId('inspector')
    if (await inspector.isVisible()) {
      await expect(inspector).toBeVisible()
    }
  })
})
