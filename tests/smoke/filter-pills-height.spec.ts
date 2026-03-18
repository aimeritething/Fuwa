import { test, expect } from '@playwright/test'

test.describe('Filter pills height matches breadcrumb bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('filter pills row height equals breadcrumb bar height (45px)', async ({ page }) => {
    // Click on the "Projects" type section in the sidebar
    await page.getByText('Projects', { exact: true }).click()

    // Filter pills should now be visible
    const pills = page.getByTestId('filter-pills')
    await expect(pills).toBeVisible()

    // Verify height matches breadcrumb bar (45px)
    const pillsBox = await pills.boundingBox()
    expect(pillsBox).not.toBeNull()
    expect(pillsBox!.height).toBe(45)

    // Verify all three pills are present
    await expect(page.getByTestId('filter-pill-open')).toBeVisible()
    await expect(page.getByTestId('filter-pill-archived')).toBeVisible()
    await expect(page.getByTestId('filter-pill-trashed')).toBeVisible()

    // Open pill should be active by default
    const openPill = page.getByTestId('filter-pill-open')
    await expect(openPill).toHaveAttribute('aria-selected', 'true')

    // Verify pills are keyboard accessible (Tab + Enter)
    await openPill.focus()
    await expect(openPill).toBeFocused()
    await page.keyboard.press('Tab')
    const archivedPill = page.getByTestId('filter-pill-archived')
    await expect(archivedPill).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(archivedPill).toHaveAttribute('aria-selected', 'true')
  })
})
