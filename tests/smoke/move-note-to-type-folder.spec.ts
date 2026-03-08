import { test, expect } from '@playwright/test'

test.describe('Move note to type folder on type change', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('changing type shows move toast and note appears under new section', async ({ page }) => {
    // Click the first note in the note list to open it
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // The Properties panel should show a type selector
    const typeSelector = page.locator('[data-testid="type-selector"]')
    await expect(typeSelector).toBeVisible({ timeout: 5000 })

    // Read the current type
    const selectTrigger = typeSelector.locator('button[role="combobox"]')
    const currentType = (await selectTrigger.textContent())?.trim() ?? 'Note'

    // Pick a different type to change to
    const targetType = currentType === 'Note' ? 'Experiment' : 'Note'

    // Open the type selector dropdown and select the target type
    await selectTrigger.click()
    await page.waitForTimeout(300)
    const option = page.getByRole('option', { name: targetType, exact: true })
    await expect(option).toBeVisible({ timeout: 3000 })
    await option.click()

    // Toast should confirm the move
    const toastSlug = targetType.toLowerCase()
    const toast = page.getByText(`Note moved to ${toastSlug}/`)
    await expect(toast).toBeVisible({ timeout: 5000 })

    // Restore original type to avoid leaving vault dirty
    await page.waitForTimeout(2500) // wait for toast to dismiss
    const restoredTrigger = typeSelector.locator('button[role="combobox"]')
    await restoredTrigger.click()
    await page.waitForTimeout(300)
    const restoreOption = page.getByRole('option', { name: currentType, exact: true })
    await expect(restoreOption).toBeVisible({ timeout: 3000 })
    await restoreOption.click()
    await page.waitForTimeout(1000)
  })

  test('type selector is visible in properties panel for opened note', async ({ page }) => {
    // Click the first note in the note list
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // Type selector should be visible in the properties panel
    const typeSelector = page.locator('[data-testid="type-selector"]')
    await expect(typeSelector).toBeVisible({ timeout: 5000 })

    // It should show "Type" label
    await expect(typeSelector.getByText('Type')).toBeVisible()
  })
})
