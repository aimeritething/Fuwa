import { test, expect } from '@playwright/test'

test.describe('Changing note type preserves content (flat vault)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('type change does not load a different note into the editor', async ({ page }) => {
    // 1. Click the first note in the note list to open it
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // 2. Get the editor's H1 heading text before the type change.
    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })
    const headingBefore = await editorContainer.locator('h1').first().textContent()
    expect(headingBefore).toBeTruthy()

    // 3. The type selector should be visible in the inspector
    const typeSelector = page.locator('[data-testid="type-selector"]')
    await expect(typeSelector).toBeVisible({ timeout: 5000 })
    const selectTrigger = typeSelector.locator('button[role="combobox"]')
    const currentType = (await selectTrigger.textContent())?.trim() ?? ''

    // 4. Change the type to something different
    const targetType = currentType === 'Project' ? 'Experiment' : 'Project'
    await selectTrigger.click()
    await page.waitForTimeout(300)
    const option = page.getByRole('option', { name: targetType, exact: true })
    await expect(option).toBeVisible({ timeout: 3000 })
    await option.click()

    // 5. In flat vault, type change only updates frontmatter — no "Note moved" toast.
    //    We should see "Property updated" instead.
    const toast = page.getByText('Property updated')
    await expect(toast).toBeVisible({ timeout: 5000 })

    // 6. No "Note moved" toast should appear
    const movedToast = page.getByText('Note moved')
    await expect(movedToast).not.toBeVisible()

    // 7. CRITICAL: verify the editor still shows the SAME note's heading.
    await page.waitForTimeout(300)
    const headingAfter = await editorContainer.locator('h1').first().textContent()
    expect(headingAfter).toBe(headingBefore)

    // 8. Restore original type to leave vault clean
    await page.waitForTimeout(1000)
    const restoredTrigger = typeSelector.locator('button[role="combobox"]')
    await restoredTrigger.click()
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
