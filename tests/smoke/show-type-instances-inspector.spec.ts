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

test.describe('Type instances in inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('shows Instances section when viewing a Type note', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Project')

    // The inspector starts open by default. Look for the "Properties" header.
    // If it's collapsed, click the SlidersHorizontal icon to expand.
    const propertiesHeader = page.getByText('Properties', { exact: true })
    if (!(await propertiesHeader.isVisible())) {
      // Inspector might be collapsed — click the toggle button
      const toggleBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
      await toggleBtn.click()
      await page.waitForTimeout(300)
    }

    // The Instances section should be visible with a count
    const instancesLabel = page.getByText(/Instances \(\d+\)/)
    await expect(instancesLabel).toBeVisible({ timeout: 5000 })
  })

  test('does not show Instances section for non-Type note', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Build Laputa App')

    // No Instances section should appear for a non-Type note
    const instancesLabel = page.getByText(/Instances \(\d+\)/)
    await expect(instancesLabel).not.toBeVisible()
  })
})
