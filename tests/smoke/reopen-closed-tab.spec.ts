import { test, expect, type Page } from '@playwright/test'

/** Dispatch Ctrl+Shift+T directly via JS.
 *  Chromium intercepts Ctrl+Shift+T at the browser level ("reopen browser tab"),
 *  so we dispatch the event programmatically to bypass that. */
async function pressReopenClosedTab(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 't', code: 'KeyT', ctrlKey: true, shiftKey: true, bubbles: true,
    }))
  })
}

const TAB = '[data-tab-path]'

test.describe('Reopen closed tab (Cmd+Shift+T)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('laputa-tab-order'))
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('open note → close tab → Cmd+Shift+T → tab reopens', async ({ page }) => {
    const firstNote = page.locator('.cursor-pointer.border-b').first()
    await expect(firstNote).toBeVisible()
    await firstNote.click()
    await page.waitForTimeout(500)

    const tabs = page.locator(TAB)
    await expect(tabs.first()).toBeVisible({ timeout: 3000 })
    const tabTitle = await tabs.first().textContent()

    // Close the tab via its close button
    const closeBtn = tabs.first().locator('button').first()
    await closeBtn.click()
    await page.waitForTimeout(300)
    await expect(tabs).toHaveCount(0, { timeout: 2000 })

    // Reopen with Ctrl+Shift+T
    await pressReopenClosedTab(page)
    await page.waitForTimeout(500)

    // Verify tab is back with same title
    await expect(tabs.first()).toBeVisible({ timeout: 3000 })
    const reopenedTitle = await tabs.first().textContent()
    expect(reopenedTitle).toBe(tabTitle)
  })

  test('Cmd+Shift+T does nothing when no closed tabs', async ({ page }) => {
    const tabs = page.locator(TAB)
    const countBefore = await tabs.count()

    await pressReopenClosedTab(page)
    await page.waitForTimeout(300)

    const countAfter = await tabs.count()
    expect(countAfter).toBe(countBefore)
  })
})
