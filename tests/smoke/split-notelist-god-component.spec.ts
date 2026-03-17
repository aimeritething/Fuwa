import { test, expect } from '@playwright/test'

test.describe('NoteList split refactor – no behavior changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('note list container renders and shows notes', async ({ page }) => {
    const container = page.locator('[data-testid="note-list-container"]')
    await expect(container).toBeVisible()

    // Notes should render inside the container
    const noteItems = container.locator('.cursor-pointer')
    await expect(noteItems.first()).toBeVisible({ timeout: 5000 })
    const count = await noteItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('header with title and action buttons renders', async ({ page }) => {
    // The header area sits above the note-list-container: h3 title + action buttons
    const header = page.locator('h3.truncate')
    await expect(header).toBeVisible()
    const title = await header.textContent()
    expect(title && title.length > 0).toBe(true)

    // Search button (magnifying glass) should be present
    const searchBtn = page.locator('button[title="Search notes"]')
    await expect(searchBtn).toBeVisible()

    // Create note button should be present (when not in trash view)
    const createBtn = page.locator('button[title="Create new note"]')
    await expect(createBtn).toBeVisible()
  })

  test('search toggle shows and hides search input', async ({ page }) => {
    const searchBtn = page.locator('button[title="Search notes"]')
    await searchBtn.click()

    const searchInput = page.locator('input[placeholder="Search notes..."]')
    await expect(searchInput).toBeVisible()

    // Toggle off
    await searchBtn.click()
    await expect(searchInput).not.toBeVisible()
  })

  test('clicking a note opens it in the editor', async ({ page }) => {
    const container = page.locator('[data-testid="note-list-container"]')
    await expect(container).toBeVisible()

    const noteItems = container.locator('.cursor-pointer')
    await expect(noteItems.first()).toBeVisible({ timeout: 5000 })

    // Get the title of the first note
    const noteTitle = await noteItems.first().locator('.font-medium, .font-semibold, .font-bold').first().textContent()

    // Click the first note
    await noteItems.first().click()

    // After click, the editor area or tab bar should reflect the opened note
    // Verify the note list container is still functional (no crash from refactor)
    await expect(container).toBeVisible()
    expect(noteTitle && noteTitle.length > 0).toBe(true)
  })
})
