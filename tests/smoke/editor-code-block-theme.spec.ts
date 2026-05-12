import { expect, test, type Locator } from '@playwright/test'
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
  fs.mkdirSync(path.dirname(notePath), { recursive: true })
  fs.writeFileSync(notePath, `---
Is A: Note
Status: Active
---

# ${CODE_NOTE_TITLE}

Inline \`const answer = 42\` should stay on the lighter inline chip.

\`\`\`ts
const answer = 42
console.log(answer)
console.log("a deliberately long line that should wrap instead of forcing the editor to scroll horizontally", answer)
\`\`\`
`)
}

async function backgroundColor(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

async function textColor(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).color)
}

async function computedStyle(locator: Locator, property: string) {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

async function computedPseudoStyle(locator: Locator, pseudoElement: string, property: string) {
  return locator.evaluate(
    (element, args) => getComputedStyle(element, args.pseudoElement).getPropertyValue(args.property),
    { pseudoElement, property },
  )
}

test.describe('Editor code block theme', () => {
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

    await expect(codeBlock).toBeVisible({ timeout: 10_000 })
    await expect(inlineCode).toBeVisible({ timeout: 10_000 })
    await expect(fencedCode).toBeVisible()
    await expect(codeBlock).toHaveAttribute('data-line-numbers', '1\n2\n3')

    await expect.poll(() => backgroundColor(inlineCode)).toBe('rgb(240, 240, 239)')
    await expect.poll(() => backgroundColor(codeBlock)).toBe('rgb(247, 246, 243)')
    await expect.poll(() => backgroundColor(fencedCode)).toBe('rgba(0, 0, 0, 0)')
    await expect.poll(() => textColor(fencedCode)).toBe('rgb(55, 53, 47)')
    await expect.poll(() => textColor(highlightedToken)).toBe('rgb(55, 53, 47)')
    await expect.poll(() => computedStyle(fencedCode, 'white-space')).toBe('pre-wrap')
    await expect.poll(() => computedStyle(fencedCode, 'overflow-wrap')).toBe('anywhere')
    await expect.poll(() => computedPseudoStyle(codeBlock, '::before', 'white-space')).toBe('pre')

    await fencedCode.evaluate((element) => {
      const range = document.createRange()
      range.setStart(element, 0)
      range.collapse(true)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain('console.log(answer)')
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).not.toContain(CODE_NOTE_TITLE)

    await page.getByTestId('status-theme-mode').click()
    await expect.poll(() => backgroundColor(codeBlock)).toBe('rgb(22, 22, 22)')
    await expect.poll(() => textColor(fencedCode)).toBe('rgb(255, 255, 255)')

    await page.getByTestId('status-theme-mode').click()
    await expect.poll(() => backgroundColor(codeBlock)).toBe('rgb(247, 246, 243)')
    await expect.poll(() => textColor(fencedCode)).toBe('rgb(55, 53, 47)')
    await expect(highlightedToken).toBeVisible()
  })
})
