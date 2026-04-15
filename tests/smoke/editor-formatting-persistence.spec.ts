import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { openCommandPalette, executeCommand } from './helpers'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openNote(page: Page, title: string) {
  await page.locator('[data-testid="note-list-container"]').getByText(title, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function openRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 5_000 })
}

async function openBlockNoteMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function getRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: {
            doc: {
              toString(): string
            }
          }
        }
      }
    }

    const el = document.querySelector('.cm-content')
    if (!el) return ''
    const view = (el as CodeMirrorHost).cmTile?.view
    if (view) return view.state.doc.toString() as string
    return el.textContent ?? ''
  })
}

async function selectWord(page: Page, blockIndex: number, word: string) {
  const block = page.locator('.bn-block-content').nth(blockIndex)
  await expect(block).toBeVisible({ timeout: 5_000 })

  const selected = await block.evaluate((element, targetWord) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
      const node = walker.currentNode
      const content = node.textContent ?? ''
      const index = content.indexOf(targetWord)

      if (index === -1) continue

      const selection = window.getSelection()
      if (!selection) return false

      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + targetWord.length)
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))

      return true
    }

    return false
  }, word)

  expect(selected).toBe(true)
  await expect(page.locator('.bn-formatting-toolbar')).toBeVisible({ timeout: 5_000 })
}

test('toolbar only exposes markdown-safe formatting controls', async ({ page }) => {
  await openNote(page, 'Note B')
  await selectWord(page, 1, 'referenced')

  await expect(page.getByRole('button', { name: 'Paragraph' })).toHaveCount(0)
  await expect(page.locator('.bn-formatting-toolbar [data-test="bold"]')).toBeVisible()
  await expect(page.locator('.bn-formatting-toolbar [data-test="italic"]')).toBeVisible()
  await expect(page.locator('.bn-formatting-toolbar [data-test="strike"]')).toBeVisible()
  await expect(page.locator('.bn-formatting-toolbar [data-test="createLink"]')).toBeVisible()

  await expect(page.locator('.bn-formatting-toolbar [data-test="underline"]')).toHaveCount(0)
  await expect(page.locator('.bn-formatting-toolbar [data-test="colors"]')).toHaveCount(0)
  await expect(page.locator('.bn-formatting-toolbar [data-test="alignTextLeft"]')).toHaveCount(0)
  await expect(page.locator('.bn-formatting-toolbar [data-test="alignTextCenter"]')).toHaveCount(0)
  await expect(page.locator('.bn-formatting-toolbar [data-test="alignTextRight"]')).toHaveCount(0)
})

test('supported inline formatting persists after note switches when applied from keyboard', async ({ page }) => {
  await openNote(page, 'Note B')
  await selectWord(page, 1, 'referenced')
  await page.keyboard.press('Meta+b')
  await page.waitForTimeout(700)

  await openNote(page, 'Note C')
  await openNote(page, 'Note B')
  await openRawMode(page)

  const raw = await getRawEditorContent(page)
  expect(raw).toContain('This is Note B, **referenced** by Alpha Project.')
})

test('slash menu block commands persist bullet lists', async ({ page }) => {
  await openNote(page, 'Note B')
  await page.locator('.bn-block-content').nth(1).click()
  await page.keyboard.type('/bul')
  await expect(page.getByRole('option', { name: /Bullet List/i })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Persisted bullet')
  await page.waitForTimeout(700)

  await openNote(page, 'Note C')
  await openNote(page, 'Note B')
  await openRawMode(page)

  const raw = await getRawEditorContent(page)
  expect(raw).toContain('- Persisted bullet')

  await openBlockNoteMode(page)
  await expect(page.locator('.bn-block-content[data-content-type="bulletListItem"]').first()).toContainText(
    'Persisted bullet',
  )
})
