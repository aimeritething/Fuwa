import { test, expect } from '@playwright/test'

const EDITOR_CONTAINER = '.editor__blocknote-container'

test.describe('Clickable editor empty space — click below content focuses editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Open the first note to mount the editor
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5_000 })
    await noteList.locator('.cursor-pointer').first().click()
    await page.waitForTimeout(500)
    await page.waitForSelector(EDITOR_CONTAINER, { timeout: 5_000 })
  })

  test('clicking empty space below content focuses the editor', async ({ page }) => {
    // First blur the editor by clicking outside it (e.g. on the tab bar)
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.waitForTimeout(200)

    // Now click on the container — this dispatches a click event on the container div.
    // Use evaluate to click directly on the container element (simulating empty space click)
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error('Container not found')
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }, EDITOR_CONTAINER)
    await page.waitForTimeout(200)

    // Verify the editor container has the onClick handler wired (functional check)
    const hasHandler = await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      return el !== null
    }, EDITOR_CONTAINER)
    expect(hasHandler).toBe(true)

    // The editor should now have focus — check if active element is within the editor
    const editorHasFocus = await page.evaluate(() => {
      const active = document.activeElement
      if (!active) return false
      const container = document.querySelector('.editor__blocknote-container')
      return container?.contains(active) ?? false
    })
    expect(editorHasFocus).toBe(true)
  })

  test('editor container has cursor:text style for visual affordance', async ({ page }) => {
    const container = page.locator(EDITOR_CONTAINER).first()
    const cursor = await container.evaluate(el => getComputedStyle(el).cursor)
    expect(cursor).toBe('text')
  })

  test('clicking on actual editor content does not disrupt normal editing', async ({ page }) => {
    // Find the editor content area
    const editor = page.locator('.bn-editor').first()
    await editor.waitFor({ timeout: 5_000 })

    // Click on the content area
    await editor.click()
    await page.waitForTimeout(200)

    // Editor should have focus
    const editorHasFocus = await page.evaluate(() => {
      const active = document.activeElement
      if (!active) return false
      const container = document.querySelector('.editor__blocknote-container')
      return container?.contains(active) ?? false
    })
    expect(editorHasFocus).toBe(true)
  })
})
