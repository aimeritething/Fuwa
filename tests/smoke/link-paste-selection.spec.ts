import { expect, test, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultTauri,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

let tempVaultDir: string

async function openNote(page: Page, title: string): Promise<void> {
  await page.locator('[data-testid="note-list-container"]').getByText(title, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function selectLinkText(page: Page, href: string): Promise<void> {
  await page.locator(`.bn-editor a[href="${href}"]`).evaluate((link) => {
    const range = document.createRange()
    range.selectNodeContents(link)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    link.closest<HTMLElement>('.bn-editor')?.focus()
  })
}

test.describe('rich-editor link paste regression', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page
    testInfo.setTimeout(60_000)
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('pasting a URL links selected text and Cmd+K edits that link @smoke', async ({ page, context }) => {
    const label = 'Selected link label'
    const url = 'https://example.com/docs?section=editor&mode=rich'
    const selectLine = process.platform === 'darwin' ? 'Meta+Shift+ArrowLeft' : 'Control+Shift+ArrowLeft'
    const commandKey = process.platform === 'darwin' ? 'Meta+K' : 'Control+K'

    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openFixtureVaultTauri(page, tempVaultDir)
    await openNote(page, 'Note B')

    const lastParagraph = page.locator('.bn-editor [data-content-type="paragraph"]').last()
    await lastParagraph.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type(label)
    await page.keyboard.press(selectLine)
    await page.evaluate(async (value) => navigator.clipboard.writeText(value), url)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')

    const link = page.locator(`.bn-editor a[href="${url}"]`).last()
    await expect(link).toHaveText(label)

    await selectLinkText(page, url)
    await page.keyboard.press(commandKey)
    await expect(page.locator('.bn-form-popover')).toBeVisible()
    await expect(page.locator('input[placeholder="Type a command..."]')).toHaveCount(0)

    await page.keyboard.press('Escape')
    await triggerMenuCommand(page, 'file-save')
    await triggerMenuCommand(page, 'edit-toggle-raw-editor')
    await expect(page.getByTestId('raw-editor-codemirror')).toContainText(`[${label}](${url})`)
  })
})
