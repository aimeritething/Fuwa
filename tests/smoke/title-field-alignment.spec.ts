import { test, expect } from '@playwright/test'

test.describe('TitleField alignment and separator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Open a note so TitleField is visible
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(500)
  })

  test('title-section and editor body share the same scroll container', async ({ page }) => {
    // The .editor-scroll-area should contain both .title-section and .editor__blocknote-container
    const scrollArea = page.locator('.editor-scroll-area')
    await expect(scrollArea).toBeVisible({ timeout: 3000 })

    const titleSection = scrollArea.locator('.title-section')
    await expect(titleSection).toBeVisible()

    const editorContainer = scrollArea.locator('.editor__blocknote-container')
    await expect(editorContainer).toBeVisible()
  })

  test('separator line is visible between title and editor', async ({ page }) => {
    const separator = page.locator('.title-section__separator')
    await expect(separator).toBeVisible({ timeout: 3000 })

    // Separator must have a visible border-bottom
    const borderBottom = await separator.evaluate(
      el => getComputedStyle(el).borderBottomStyle
    )
    expect(borderBottom).toBe('solid')
  })

  test('title-section and editor content are horizontally aligned', async ({ page }) => {
    // Resize viewport to a wide width to test alignment
    await page.setViewportSize({ width: 1400, height: 800 })
    await page.waitForTimeout(300)

    const titleSection = page.locator('.title-section')
    const editorBlock = page.locator('.editor__blocknote-container .bn-editor')

    await expect(titleSection).toBeVisible({ timeout: 3000 })
    await expect(editorBlock).toBeVisible({ timeout: 3000 })

    const titleBox = await titleSection.boundingBox()
    const editorBox = await editorBlock.boundingBox()

    expect(titleBox).not.toBeNull()
    expect(editorBox).not.toBeNull()

    // Both should have the same left edge (within 2px tolerance)
    expect(Math.abs(titleBox!.x - editorBox!.x)).toBeLessThanOrEqual(2)
  })

  test('title field uses H1 CSS variables for font styling', async ({ page }) => {
    // Verify the title-field__input element references the H1 heading CSS vars
    const usesH1Vars = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets)
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText === '.title-field__input') {
              const fontSize = rule.style.getPropertyValue('font-size')
              const fontWeight = rule.style.getPropertyValue('font-weight')
              return {
                fontSize: fontSize.includes('--headings-h1-font-size'),
                fontWeight: fontWeight.includes('--headings-h1-font-weight'),
              }
            }
          }
        } catch { /* cross-origin sheet */ }
      }
      return { fontSize: false, fontWeight: false }
    })

    expect(usesH1Vars.fontSize).toBe(true)
    expect(usesH1Vars.fontWeight).toBe(true)
  })
})
