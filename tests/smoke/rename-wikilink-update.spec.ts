import { test, expect } from '@playwright/test'

test.describe('Renaming a note updates wikilinks across the vault', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('title field rename triggers rename flow and shows toast @smoke', async ({ page }) => {
    // 1. Click the first note in the list to open it
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // 2. Find the title field in the editor
    const titleField = page.locator('[data-testid="title-field"] input, [data-testid="title-field"]')
    await expect(titleField.first()).toBeVisible({ timeout: 5000 })
    const originalTitle = await titleField.first().inputValue().catch(() => titleField.first().textContent())
    expect(originalTitle).toBeTruthy()

    // 3. Click the title field and change the title
    await titleField.first().click()
    await page.keyboard.press('Meta+a')
    const newTitle = `${originalTitle} Renamed`
    await page.keyboard.type(newTitle)
    await page.keyboard.press('Tab') // blur to trigger rename

    await page.waitForTimeout(1500)

    // 4. Verify the toast message appeared (confirms rename flow ran)
    const toast = page.getByText('Renamed', { exact: true })
    await expect(toast).toBeVisible({ timeout: 5000 })
  })
})
