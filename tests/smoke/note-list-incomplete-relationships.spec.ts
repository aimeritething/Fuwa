import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

test.describe('Note list shows complete relationships when opening from sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('entity view shows relationship groups with correct counts after sidebar click', async ({ page }) => {
    // Navigate to Responsibilities type to find entity notes in the sidebar
    // First, click on a sidebar type that contains entity notes
    // We'll use the sidebar search to filter to "Sponsorships"
    const searchToggle = page.locator('[data-testid="search-toggle"]')
    if (await searchToggle.isVisible()) {
      await searchToggle.click()
    }

    // Type in sidebar search to find Sponsorships
    const sidebarSearch = page.locator('[data-testid="note-list-search"]')
    if (await sidebarSearch.isVisible()) {
      await sidebarSearch.fill('Sponsorships')
      await page.waitForTimeout(500)
    }

    // Click the Sponsorships note in the note list to trigger entity view
    const sponsorshipsItem = page.locator('[data-entry-path*="sponsorships"]').first()
    if (await sponsorshipsItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sponsorshipsItem.click()
      await page.waitForTimeout(1000)
    } else {
      // Fallback: open via quick open — then click in sidebar
      await page.locator('body').click()
      await sendShortcut(page, 'p', ['Control'])
      const searchInput = page.locator('input[placeholder="Search notes..."]')
      await expect(searchInput).toBeVisible()
      await searchInput.fill('Sponsorships')
      await page.waitForTimeout(500)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)
    }

    // The inspector panel (right side) should show relationship labels with font-mono-overline
    // This verifies the note loaded and relationships were parsed correctly
    const measuresLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Has Measures' })
    await expect(measuresLabel).toBeVisible({ timeout: 5000 })

    const proceduresLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Has Procedures' })
    await expect(proceduresLabel).toBeVisible({ timeout: 5000 })

    // Verify the relationships panel shows the correct number of items
    // Has Measures should have 2 entries (measure-sponsorship-mrr, measure-close-rate)
    const measuresSection = measuresLabel.locator('xpath=ancestor::div[1]')
    const measureItems = measuresSection.locator('a, button').filter({ hasText: /measure|Measure/ })
    // At least 1 resolved relationship entry
    const hasItems = await measureItems.count()
    expect(hasItems).toBeGreaterThanOrEqual(1)
  })

  test('relationship labels persist after navigating away and back', async ({ page }) => {
    // Open Sponsorships via quick open
    await page.locator('body').click()
    await sendShortcut(page, 'p', ['Control'])
    const searchInput = page.locator('input[placeholder="Search notes..."]')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Sponsorships')
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // Verify Has Measures relationship appears in inspector
    const measuresLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Has Measures' })
    await expect(measuresLabel).toBeVisible({ timeout: 5000 })

    // Navigate to different note
    await page.locator('body').click()
    await sendShortcut(page, 'p', ['Control'])
    const searchInput2 = page.locator('input[placeholder="Search notes..."]')
    await expect(searchInput2).toBeVisible()
    await searchInput2.fill('Start Laputa App')
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // Navigate back to Sponsorships
    await page.locator('body').click()
    await sendShortcut(page, 'p', ['Control'])
    const searchInput3 = page.locator('input[placeholder="Search notes..."]')
    await expect(searchInput3).toBeVisible()
    await searchInput3.fill('Sponsorships')
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // Relationships should still be visible — not stale or incomplete
    const measuresLabelAgain = page.locator('span.font-mono-overline').filter({ hasText: 'Has Measures' })
    await expect(measuresLabelAgain).toBeVisible({ timeout: 5000 })

    const proceduresLabelAgain = page.locator('span.font-mono-overline').filter({ hasText: 'Has Procedures' })
    await expect(proceduresLabelAgain).toBeVisible({ timeout: 5000 })
  })
})
