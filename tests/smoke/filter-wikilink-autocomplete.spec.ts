import { test, expect, type Page } from '@playwright/test'

async function openCreateViewDialog(page: Page) {
  // The VIEWS header has a small + icon. Find the header button containing "VIEWS" text
  // and the + SVG icon next to it
  const viewsHeader = page.locator('button:has(span:text("VIEWS"))')
  await viewsHeader.waitFor({ timeout: 5000 })
  // The Plus icon is rendered as an SVG inside the same container
  // Click the SVG child of the VIEWS button container (the + icon)
  const plusSvg = viewsHeader.locator('svg').last()
  await plusSvg.click({ force: true })
  await expect(page.locator('text=Create View')).toBeVisible({ timeout: 5000 })
}

test.describe('Filter wikilink autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('typing [[ in filter value field shows wikilink autocomplete', async ({ page }) => {
    await openCreateViewDialog(page)

    // Default field is 'type' which has valueSuggestions (shows Select, not text input).
    // Change to 'title' field which has no suggestions → renders WikilinkValueInput.
    const fieldSelect = page.locator('button:has-text("type")').first()
    await fieldSelect.click()
    await page.locator('[role="option"]:has-text("title")').click()

    // The filter value input has data-testid="filter-value-input"
    const valueInput = page.getByTestId('filter-value-input')
    await expect(valueInput).toBeVisible()

    // Type [[ without enough chars - dropdown should not appear
    await valueInput.fill('[[')
    await expect(page.getByTestId('wikilink-dropdown')).not.toBeVisible()

    // Type enough characters to trigger the dropdown
    await valueInput.fill('[[un')
    await expect(page.getByTestId('wikilink-dropdown')).toBeVisible({ timeout: 2000 })

    // Verify dropdown contains note suggestions
    const dropdownItems = page.locator('.wikilink-menu__item')
    const count = await dropdownItems.count()
    expect(count).toBeGreaterThan(0)

    // Click a suggestion to select it
    const firstItem = dropdownItems.first()
    const itemText = await firstItem.locator('.wikilink-menu__title').textContent()
    await firstItem.click()

    // Verify the value was set to [[note-title]]
    const inputValue = await valueInput.inputValue()
    expect(inputValue).toMatch(/^\[\[.+\]\]$/)
    expect(inputValue).toContain(itemText?.trim() ?? '')

    // Verify dropdown closed after selection
    await expect(page.getByTestId('wikilink-dropdown')).not.toBeVisible()
  })

  test('plain text in filter value does not trigger autocomplete', async ({ page }) => {
    await openCreateViewDialog(page)

    // Change field to 'title' (no suggestions → WikilinkValueInput)
    const fieldSelect = page.locator('button:has-text("type")').first()
    await fieldSelect.click()
    await page.locator('[role="option"]:has-text("title")').click()

    const valueInput = page.getByTestId('filter-value-input')
    await valueInput.fill('some plain text')

    // No dropdown should appear
    await expect(page.getByTestId('wikilink-dropdown')).not.toBeVisible()
  })
})
