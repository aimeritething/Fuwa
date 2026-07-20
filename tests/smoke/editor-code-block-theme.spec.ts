import { expect, test, type Locator, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

const CODE_NOTE_RELATIVE_PATH = path.join('note', 'code-block-theme.md')
const CODE_NOTE_TITLE = 'Code Block Theme'

function writeCodeThemeFixtureNote(tempVaultDir: string) {
  const notePath = path.join(tempVaultDir, CODE_NOTE_RELATIVE_PATH)
  const longSourceLine = 'This deliberately long source line must wrap inside the narrow editor. '.repeat(8)
  fs.mkdirSync(path.dirname(notePath), { recursive: true })
  fs.writeFileSync(notePath, `---
Is A: Note
Status: Active
---

# ${CODE_NOTE_TITLE}

Inline \`const answer = 42\` should stay on the lighter inline chip.

\`\`\`ts
function paint(answer: number) {
  return answer + 42
}

console.log(paint(1))
const wrapped = "${longSourceLine}"
console.log(wrapped)




\`\`\`

Convert this paragraph with the shortcut.
`)
}

async function backgroundColor(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

async function textColor(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).color)
}

async function tokenColors(locator: Locator) {
  return locator.evaluateAll((elements) => (
    Array.from(new Set(elements.map((element) => getComputedStyle(element).color)))
  ))
}

async function codeBlockGutterGeometry(page: Page, codeBlock: Locator) {
  const gutter = page.locator('[data-code-line-numbers]').first()
  return codeBlock.evaluate((block, gutterElement) => {
    const code = block.querySelector('pre code')
    const lastNumber = gutterElement?.lastElementChild
    if (!code || !gutterElement || !lastNumber) return null

    const blockRect = block.getBoundingClientRect()
    const gutterRect = gutterElement.getBoundingClientRect()
    const lastNumberRect = lastNumber.getBoundingClientRect()
    const firstText = document.createTreeWalker(code, NodeFilter.SHOW_TEXT).nextNode()
    if (!firstText || !firstText.textContent) return null
    const sourceRange = document.createRange()
    sourceRange.setStart(firstText, 0)
    sourceRange.setEnd(firstText, 1)
    const sourceRect = sourceRange.getClientRects()[0]
    if (!sourceRect) return null
    return {
      blockBottom: blockRect.bottom,
      blockTop: blockRect.top,
      gutterTop: gutterRect.top,
      lastNumberBottom: lastNumberRect.bottom,
      sourceLeftOffset: sourceRect.left - blockRect.left,
    }
  }, await gutter.elementHandle())
}

test.describe('Editor code block theme', () => {
  test.setTimeout(45_000)
  let tempVaultDir: string

  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
    writeCodeThemeFixtureNote(tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('fenced code blocks follow the active theme while inline code stays muted', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    const noteList = page.locator('[data-testid="note-list-container"]')
    const noteItem = noteList.getByText(CODE_NOTE_TITLE, { exact: true })
    await expect(noteItem).toBeVisible({ timeout: 10_000 })
    await noteItem.click()

    const inlineCode = page
      .locator('[data-content-type="paragraph"] [data-style-type="code"], [data-content-type="paragraph"] code')
      .first()
    const codeBlock = page.locator('.bn-block-content[data-content-type="codeBlock"]').first()
    const fencedCode = codeBlock.locator('pre code').first()
    const highlightedToken = codeBlock.locator('.shiki').first()
    const highlightedTokens = codeBlock.locator('.shiki')

    await expect(codeBlock).toBeVisible({ timeout: 10_000 })
    await expect(inlineCode).toBeVisible({ timeout: 10_000 })
    await expect(fencedCode).toBeVisible()
    await expect(page.locator('[data-code-line-numbers]').first().locator(':scope > *')).toHaveCount(11)
    await expect.poll(() => fencedCode.evaluate((element) => {
      const pre = element.closest('pre')
      return pre ? pre.scrollWidth <= pre.clientWidth : false
    })).toBe(true)
    const gutterGeometry = await codeBlockGutterGeometry(page, codeBlock)
    expect(gutterGeometry).not.toBeNull()
    expect(gutterGeometry!.gutterTop).toBeGreaterThanOrEqual(gutterGeometry!.blockTop)
    expect(gutterGeometry!.lastNumberBottom).toBeLessThanOrEqual(gutterGeometry!.blockBottom)
    expect(gutterGeometry!.sourceLeftOffset).toBeLessThanOrEqual(58)

    await expect.poll(() => backgroundColor(inlineCode)).toBe('rgb(240, 240, 239)')
    await expect.poll(() => backgroundColor(fencedCode)).toBe('rgba(0, 0, 0, 0)')
    await expect.poll(() => textColor(fencedCode)).toBe('rgb(55, 53, 47)')
    const lightCodeBlockBackground = await backgroundColor(codeBlock)
    const lightTokenColors = await tokenColors(highlightedTokens)
    expect(lightTokenColors.length).toBeGreaterThan(0)

    await page.getByTestId('status-theme-mode').click()
    await expect.poll(() => backgroundColor(codeBlock)).toBe('rgb(22, 22, 22)')
    await expect.poll(() => textColor(fencedCode)).toBe('rgb(255, 255, 255)')
    await expect.poll(() => tokenColors(highlightedTokens)).not.toEqual(lightTokenColors)
    const darkTokenColors = await tokenColors(highlightedTokens)

    await page.getByTestId('status-theme-mode').click()
    await expect.poll(() => backgroundColor(codeBlock)).toBe(lightCodeBlockBackground)
    await expect.poll(() => textColor(fencedCode)).toBe('rgb(55, 53, 47)')
    await expect.poll(() => tokenColors(highlightedTokens)).not.toEqual(darkTokenColors)
    await expect(highlightedToken).toBeVisible()
  })

  test('creates a code block by shortcut and scopes select-all to its source', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    const noteItem = page.locator('[data-testid="note-list-container"]')
      .getByText(CODE_NOTE_TITLE, { exact: true })
    await expect(noteItem).toBeVisible({ timeout: 10_000 })
    await noteItem.click()

    const source = 'Convert this paragraph with the shortcut.'
    await expect(page.locator('.bn-editor')).toContainText(source, { timeout: 10_000 })
    const paragraph = page.locator('.bn-editor [data-content-type="paragraph"]')
      .filter({ hasText: source })
      .last()
    await expect(paragraph).toBeVisible()
    await paragraph.click()
    await page.keyboard.press(process.platform === 'darwin'
      ? 'Meta+Shift+Backquote'
      : 'Control+Shift+Backquote')

    const createdCode = page.locator('[data-content-type="codeBlock"] pre code', { hasText: source })
    await expect(createdCode).toBeVisible()
    await createdCode.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await expect.poll(() => page.evaluate(() => document.getSelection()?.toString())).toBe(source)
  })
})
