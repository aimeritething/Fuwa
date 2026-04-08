import { test, expect } from '@playwright/test'

test.describe('AI chat empty body fix — no regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="note-list-container"]')).toBeVisible({ timeout: 5_000 })
  })

  test('AI panel opens, note is selected, message can be sent and response renders @smoke', async ({ page }) => {
    // Select a note so the AI panel has context
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()

    // Verify editor has content (note body is loaded)
    const editor = page.locator('.bn-editor')
    await expect(editor).toBeVisible({ timeout: 3000 })

    // Open AI Chat from the editor toolbar
    await page.getByTitle('Open AI Chat').click()
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })

    // Send a message
    const input = page.locator('input[placeholder*="Ask"]')
    await expect(input).toBeVisible()
    await input.fill('What does this note contain?')
    await page.getByTestId('agent-send').click()

    // Wait for mock AI response to render (mock returns fixed text after 300ms)
    await expect(page.getByTestId('ai-message').first()).toBeVisible({ timeout: 5000 })

    // Verify the response text is rendered (mock includes wikilinks)
    await expect(page.getByTestId('ai-message').first()).not.toBeEmpty()
  })
})
