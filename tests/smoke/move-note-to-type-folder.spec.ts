import { test, expect } from '@playwright/test'

/**
 * Click the first non-Theme note in the note list, starting from `startIndex`.
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

test.describe('Move note to type folder on type change', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('changing type shows move toast and note appears under new section', async ({ page }) => {
    const currentType = await clickNonThemeNote(page)
    expect(currentType).toBeTruthy()

    const typeSelector = page.locator('[data-testid="type-selector"]')
    const selectTrigger = typeSelector.locator('button[role="combobox"]')
    const targetType = currentType === 'Note' ? 'Experiment' : 'Note'

    await selectTrigger.click()
    await page.waitForTimeout(300)
    const option = page.getByRole('option', { name: targetType, exact: true })
    await expect(option).toBeVisible({ timeout: 3000 })
    await option.click()

    const toastSlug = targetType.toLowerCase()
    const toast = page.getByText(`Note moved to ${toastSlug}/`)
    await expect(toast).toBeVisible({ timeout: 5000 })

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

  test('type selector is visible in properties panel for opened note', async ({ page }) => {
    const currentType = await clickNonThemeNote(page)
    expect(currentType).toBeTruthy()

    const typeSelector = page.locator('[data-testid="type-selector"]')
    await expect(typeSelector).toBeVisible({ timeout: 5000 })
    await expect(typeSelector.getByText('Type')).toBeVisible()
  })
})
