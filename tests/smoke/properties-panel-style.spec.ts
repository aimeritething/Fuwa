import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

async function openNoteViaQuickOpen(page: import('@playwright/test').Page, query: string) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  const searchInput = page.locator('input[placeholder="Search notes..."]')
  await expect(searchInput).toBeVisible()
  await searchInput.fill(query)
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
}

test.describe('Properties panel visual style', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('labels are sentence case, not ALL CAPS', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Untitled note 58')

    const propertyRows = page.locator('[data-testid="editable-property"]')
    await expect(propertyRows.first()).toBeVisible({ timeout: 5000 })

    // Labels should be sentence case (e.g. "Status"), not ALL CAPS
    const statusLabel = propertyRows.locator('span.truncate').filter({ hasText: 'Status' })
    await expect(statusLabel).toBeVisible()

    // Verify no ALL CAPS label exists
    const allLabels = propertyRows.locator('span.truncate')
    const count = await allLabels.count()
    for (let i = 0; i < count; i++) {
      const text = await allLabels.nth(i).textContent()
      if (text && text.length > 1) {
        expect(text).not.toEqual(text.toUpperCase())
      }
    }
  })

  test('status renders as colored badge with dot indicator', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Untitled note 58')

    const statusBadge = page.locator('[data-testid="status-badge"]')
    await expect(statusBadge).toBeVisible({ timeout: 5000 })
    await expect(statusBadge).toHaveText('Active')

    // Should have a dot indicator (small circle span inside)
    const dot = statusBadge.locator('span.rounded-full')
    await expect(dot).toBeVisible()
  })

  test('date renders as chip with background', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Untitled note 58')

    const dateDisplay = page.locator('[data-testid="date-display"]')
    // Date may or may not exist in the note — if it exists, verify chip styling
    const count = await dateDisplay.count()
    if (count > 0) {
      await expect(dateDisplay.first()).toHaveClass(/bg-muted/)
    }
  })

  test('boolean renders as checkbox', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Untitled note 58')

    const booleanToggle = page.locator('[data-testid="boolean-toggle"]')
    const count = await booleanToggle.count()
    if (count > 0) {
      // Should contain an actual checkbox input
      const checkbox = booleanToggle.first().locator('input[type="checkbox"]')
      await expect(checkbox).toBeVisible()
    }
  })

  test('no horizontal overflow from property values', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Untitled note 58')

    const propertyRows = page.locator('[data-testid="editable-property"]')
    await expect(propertyRows.first()).toBeVisible({ timeout: 5000 })

    // Each row should not overflow its container
    const count = await propertyRows.count()
    for (let i = 0; i < count; i++) {
      const row = propertyRows.nth(i)
      const box = await row.boundingBox()
      if (!box) continue
      // Inspector panel is ~300px wide; rows shouldn't exceed parent
      expect(box.width).toBeLessThan(500)
    }
  })

  test('add property button is subtle', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Untitled note 58')

    const addBtn = page.getByText('Add property')
    await expect(addBtn).toBeVisible({ timeout: 5000 })

    // Should have reduced opacity (subtle appearance)
    await expect(addBtn).toHaveCSS('opacity', '0.5')
  })
})
