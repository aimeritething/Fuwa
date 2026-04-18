import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

let tempVaultDir: string

async function openNote(page: Page, title: string) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.getByText(title, { exact: true }).click()
}

async function openRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 5_000 })
}

async function getRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.cm-content')
    if (!el) return ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (view) return view.state.doc.toString() as string
    return el.textContent ?? ''
  })
}

async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((nextContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) {
      throw new Error('CodeMirror content element is missing')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (!view) {
      throw new Error('CodeMirror view is missing')
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextContent },
    })
  }, content)
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke switching notes persists unsaved raw edits without waiting for the debounce window', async ({ page }) => {
  const noteBPath = path.join(tempVaultDir, 'note', 'note-b.md')
  const appendedText = `Flushed before note switch ${Date.now()}`

  await openNote(page, 'Note B')
  await openRawMode(page)

  const rawContent = await getRawEditorContent(page)
  await setRawEditorContent(page, `${rawContent}\n\n${appendedText}`)
  await page.waitForTimeout(100)

  await openNote(page, 'Alpha Project')

  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText('alpha-project', { timeout: 5_000 })
  await expect.poll(async () => getRawEditorContent(page)).toContain('# Alpha Project')
  await expect.poll(
    () => fs.readFileSync(noteBPath, 'utf8'),
    { timeout: 450, intervals: [50, 100, 100, 100, 100] },
  ).toContain(appendedText)
})
