import { test, expect } from '@playwright/test'

test.describe('Raw editor type propagation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('editing type in raw editor immediately updates Properties panel', async ({ page }) => {
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5000 })
    const items = noteList.locator('.cursor-pointer')
    const count = await items.count()
    test.skip(count === 0, 'No notes in note list')

    // Click first note and open Properties panel
    await items.nth(0).click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Control+Shift+i')
    await page.waitForTimeout(500)

    // Find a note with a visible type selector (skip Theme)
    const typeSelector = page.locator('[data-testid="type-selector"]')
    let originalType = ''
    for (let i = 0; i < Math.min(count, 10); i++) {
      await items.nth(i).click()
      await page.waitForTimeout(400)
      if (!(await typeSelector.isVisible())) continue
      const trigger = typeSelector.locator('button[role="combobox"]')
      const text = (await trigger.textContent())?.trim() ?? ''
      if (text && !text.includes('Theme')) {
        originalType = text
        break
      }
    }
    test.skip(!originalType, 'No non-Theme note with type selector found')

    // Open raw editor (Ctrl+\)
    await page.keyboard.press('Control+Backslash')
    const rawEditor = page.locator('[data-testid="raw-editor-codemirror"]')
    await expect(rawEditor).toBeVisible({ timeout: 3000 })
    await page.waitForTimeout(300)

    // Find the "type:" line in the editor
    const typeLineIndex = await page.evaluate(() => {
      const lines = document.querySelectorAll('.cm-line')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].textContent?.match(/^(?:type|Is A):\s/i)) return i
      }
      return -1
    })
    test.skip(typeLineIndex < 0, 'No type field found in frontmatter')

    // Click the type line, select it, and retype with new type
    const typeLine = page.locator('.cm-line').nth(typeLineIndex)
    await typeLine.click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')

    const newType = originalType.includes('Note') ? 'Project' : 'Note'
    await page.keyboard.type(`type: ${newType}`)

    // Wait for debounce (500ms) + state propagation
    await page.waitForTimeout(800)

    // Verify Properties panel shows the new type
    const trigger = typeSelector.locator('button[role="combobox"]')
    await expect(trigger).toContainText(newType, { timeout: 3000 })

    // Restore: select the type line and retype original
    const restoreLineIndex = await page.evaluate(() => {
      const lines = document.querySelectorAll('.cm-line')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].textContent?.match(/^type:\s/)) return i
      }
      return -1
    })
    if (restoreLineIndex >= 0) {
      const restoreLine = page.locator('.cm-line').nth(restoreLineIndex)
      await restoreLine.click()
      await page.keyboard.press('Home')
      await page.keyboard.press('Shift+End')
      await page.keyboard.type(`type: ${originalType.replace(/Note$/, '')}`)
      await page.waitForTimeout(800)
    }

    // Close raw editor
    await page.keyboard.press('Control+Backslash')
    await page.waitForTimeout(300)
  })
})
