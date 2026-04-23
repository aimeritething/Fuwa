import { test, expect, type Page } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'

const AI_AGENTS_ONBOARDING_DISMISSED_KEY = 'tolaria:ai-agents-onboarding-dismissed'
const CLAUDE_CODE_ONBOARDING_DISMISSED_KEY = 'tolaria:claude-code-onboarding-dismissed'

async function createNote(page: Page) {
  await page.waitForSelector('[data-testid="sidebar-top-nav"]', { timeout: 10000 })
  await page.locator('button[title="Create new note"]').first().click()
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, {
    timeout: 5_000,
  })
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
}

async function toggleRawEditor(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
}

async function getRawEditorContent(page: Page) {
  return page.locator('[data-testid="raw-editor-codemirror"]').evaluate((element) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (element as any).__cmView
    return view?.state?.doc?.toString?.() ?? element.textContent ?? ''
  })
}

test('typing keeps arrow ligatures aligned between rich and raw editors', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.addInitScript(({ aiAgentsKey, claudeKey }: { aiAgentsKey: string; claudeKey: string }) => {
    localStorage.clear()
    localStorage.setItem(aiAgentsKey, '1')
    localStorage.setItem(claudeKey, '1')
  }, {
    aiAgentsKey: AI_AGENTS_ONBOARDING_DISMISSED_KEY,
    claudeKey: CLAUDE_CODE_ONBOARDING_DISMISSED_KEY,
  })
  await page.goto(process.env.BASE_URL ?? 'http://localhost:5201', { waitUntil: 'domcontentloaded' })

  await createNote(page)
  await page.keyboard.type('-> <- <-> \\<->')

  await expect(page.locator('.bn-editor')).toContainText('→ ← ↔ <->', { timeout: 5_000 })

  await toggleRawEditor(page)
  await expect(page.locator('[data-testid="raw-editor-codemirror"]')).toBeVisible({ timeout: 5_000 })
  await expect.poll(() => getRawEditorContent(page)).toContain('→ ← ↔ <->')

  await page.locator('[data-testid="raw-editor-codemirror"]').click()
  await page.keyboard.type('\n-> <- <-> \\<->')
  await expect.poll(() => getRawEditorContent(page)).toMatch(/→ ← ↔ <->\s+→ ← ↔ <->/u)

  await toggleRawEditor(page)
  await expect(page.locator('.bn-editor')).toContainText('→ ← ↔ <->', { timeout: 5_000 })
})
