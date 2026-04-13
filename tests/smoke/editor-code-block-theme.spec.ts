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
\`\`\`
`)
}

async function backgroundColor(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
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

  test('fenced code blocks keep the dark BlockNote surface while inline code stays muted', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    await page.getByText(CODE_NOTE_TITLE, { exact: true }).first().click()

    const inlineCode = page.locator('.bn-inline-content code').first()
    const codeBlock = page.locator('.bn-block-content[data-content-type="codeBlock"]').first()

    await expect(inlineCode).toBeVisible()
    await expect(codeBlock).toBeVisible()

    await expect.poll(() => backgroundColor(inlineCode)).toBe('rgb(240, 240, 239)')
    await expect.poll(() => backgroundColor(codeBlock)).toBe('rgb(22, 22, 22)')
  })
})
