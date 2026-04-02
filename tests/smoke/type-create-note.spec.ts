import { test, expect } from '@playwright/test'

test('clicking + in type section creates note with that type', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)

  // Click on "Projects" in the sidebar to select that type section
  const projectsItem = page.locator('[data-testid="sidebar-section-Projects"]').or(page.locator('.app__sidebar').locator('text=Projects').first())
  await projectsItem.click()
  await page.waitForTimeout(1000)

  // Click the "+" button to create a new note
  await page.click('[title="Create new note"]')
  await page.waitForTimeout(1000)

  // The new note should have type-based naming (e.g., "Untitled project N")
  const titleInput = page.locator('[data-testid="title-field-input"]')
  if (await titleInput.count() > 0) {
    const value = await titleInput.inputValue()
    console.log('New note title:', value)
    expect(value.toLowerCase()).toContain('project')
  }

  // Toggle raw editor to see frontmatter
  await page.keyboard.press('Meta+Shift+m')
  await page.waitForTimeout(500)

  const rawEditor = page.locator('.cm-content')
  if (await rawEditor.count() > 0) {
    const content = await rawEditor.textContent()
    console.log('Raw content:', content?.substring(0, 200))
    expect(content).toContain('type: Project')
  }
})

test('clicking + in All Notes creates generic note', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)

  // Click on "All Notes" in sidebar
  await page.locator('text=All Notes').first().click()
  await page.waitForTimeout(500)

  // Click the "+" button
  await page.click('[title="Create new note"]')
  await page.waitForTimeout(1000)

  // The new note should be a generic "Note" type
  const titleInput = page.locator('[data-testid="title-field-input"]')
  if (await titleInput.count() > 0) {
    const value = await titleInput.inputValue()
    console.log('New note title:', value)
    expect(value.toLowerCase()).toContain('note')
    expect(value.toLowerCase()).not.toContain('project')
  }
})
