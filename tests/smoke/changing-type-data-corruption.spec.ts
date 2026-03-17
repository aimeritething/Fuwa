import { test, expect } from '@playwright/test'

/**
 * Click the first non-Theme note in the note list, starting from `startIndex`.
 * Theme notes appear first in the vault and don't have standard type selectors.
 */
async function clickNonThemeNote(page: import('@playwright/test').Page, startIndex = 0) {
  const noteListContainer = page.locator('[data-testid="note-list-container"]')
  await noteListContainer.waitFor({ timeout: 5000 })
  const items = noteListContainer.locator('.cursor-pointer')
  const count = await items.count()

  for (let i = startIndex; i < Math.min(count, startIndex + 15); i++) {
    await items.nth(i).click()
    await page.waitForTimeout(500)
    const typeSelector = page.locator('[data-testid="type-selector"]')
    if (!(await typeSelector.isVisible())) continue
    const trigger = typeSelector.locator('button[role="combobox"]')
    const type = (await trigger.textContent())?.trim() ?? ''
    if (type !== 'Theme') return type
  }
  return ''
}

test.describe('Changing note type preserves content (data corruption fix)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('type change does not load a different note into the editor', async ({ page }) => {
    const currentType = await clickNonThemeNote(page)
    expect(currentType).toBeTruthy()

    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })
    const headingBefore = await editorContainer.locator('h1').first().textContent()
    expect(headingBefore).toBeTruthy()

    const typeSelector = page.locator('[data-testid="type-selector"]')
    const selectTrigger = typeSelector.locator('button[role="combobox"]')

    const targetType = currentType === 'Project' ? 'Experiment' : 'Project'
    await selectTrigger.click()
    await page.waitForTimeout(300)
    const option = page.getByRole('option', { name: targetType, exact: true })
    await expect(option).toBeVisible({ timeout: 3000 })
    await option.click()

    const toastSlug = targetType.toLowerCase()
    const toast = page.getByText(`Note moved to ${toastSlug}/`)
    await expect(toast).toBeVisible({ timeout: 5000 })

    await page.waitForTimeout(300)
    const headingAfter = await editorContainer.locator('h1').first().textContent()
    expect(headingAfter).toBe(headingBefore)

    // Restore original type
    await page.waitForTimeout(2500)
    await selectTrigger.click()
    await page.waitForTimeout(300)
    const restoreOption = page.getByRole('option', { name: currentType, exact: true })
    if (await restoreOption.isVisible()) {
      await restoreOption.click()
      await page.waitForTimeout(1000)
    } else {
      await page.keyboard.press('Escape')
    }
  })

  test('changing type of existing note preserves its content', async ({ page }) => {
    // Use a different start index to pick a different note from test 1
    const currentType = await clickNonThemeNote(page, 1)
    test.skip(!currentType, 'No non-Theme note found with visible type selector')

    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 8000 })
    const headingBefore = await editorContainer.locator('h1').first().textContent()
    expect(headingBefore).toBeTruthy()

    const typeSelector = page.locator('[data-testid="type-selector"]')
    const selectTrigger = typeSelector.locator('button[role="combobox"]')
    const targetType = currentType === 'Experiment' ? 'Person' : 'Experiment'

    await selectTrigger.click()
    await page.waitForTimeout(300)
    const option = page.getByRole('option', { name: targetType, exact: true })
    await expect(option).toBeVisible({ timeout: 3000 })
    await option.click()

    await page.waitForTimeout(1000)
    const headingAfter = await editorContainer.locator('h1').first().textContent()
    expect(headingAfter).toBe(headingBefore)

    // Restore original type
    await selectTrigger.click()
    await page.waitForTimeout(300)
    const restoreOption = page.getByRole('option', { name: currentType, exact: true })
    if (await restoreOption.isVisible()) {
      await restoreOption.click()
      await page.waitForTimeout(1000)
    } else {
      await page.keyboard.press('Escape')
    }
  })
})
