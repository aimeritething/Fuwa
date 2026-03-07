import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

test.describe('AI chat wikilink rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Block vault API so mock entries are used (ensures "Build Laputa App" exists)
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))

    await page.goto('/')
    await page.waitForTimeout(500)

    // Select a note so the AI panel has context
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Open AI Chat with Ctrl+I
    await sendShortcut(page, 'i', ['Control'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })

    // Send a message to trigger mock response with [[Build Laputa App]] and [[Matteo Cellini]]
    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('Tell me about this note')
    await page.getByTestId('agent-send').click()

    // Wait for wikilinks to render
    await expect(page.locator('.chat-wikilink').first()).toBeVisible({ timeout: 5000 })
  })

  test('[[Note]] in AI response renders as clickable wikilink', async ({ page }) => {
    const wikilink = page.locator('.chat-wikilink').first()

    // Verify wikilink text and attributes
    await expect(wikilink).toHaveText('Build Laputa App')
    await expect(wikilink).toHaveAttribute('data-wikilink-target', 'Build Laputa App')
    await expect(wikilink).toHaveAttribute('role', 'link')

    // Verify second wikilink
    const secondWikilink = page.locator('.chat-wikilink').nth(1)
    await expect(secondWikilink).toHaveText('Matteo Cellini')

    // Verify multiple wikilinks rendered
    await expect(page.locator('.chat-wikilink')).toHaveCount(2)

    // Verify wikilink has pointer cursor (is styled as clickable)
    const cursor = await wikilink.evaluate(el => getComputedStyle(el).cursor)
    expect(cursor).toBe('pointer')
  })

  test('clicking a wikilink opens the note in a tab', async ({ page }) => {
    const wikilink = page.locator('.chat-wikilink').first()
    await expect(wikilink).toHaveText('Build Laputa App')

    // Click the wikilink
    await wikilink.click()
    await page.waitForTimeout(500)

    // Verify the note opened in a tab — the editor breadcrumb shows the active note title
    const breadcrumb = page.locator('.app__editor span.truncate.font-medium', { hasText: 'Build Laputa App' })
    await expect(breadcrumb).toBeVisible({ timeout: 3000 })
  })
})
