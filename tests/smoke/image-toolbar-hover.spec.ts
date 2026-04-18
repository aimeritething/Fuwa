import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { openCommandPalette, executeCommand } from './helpers'

const IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yK9sAAAAASUVORK5CYII='

let tempVaultDir: string

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
    const el = document.querySelector('.cm-content')
    if (!el) return ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CodeMirror view is attached to the DOM node.
    const view = (el as any).cmTile?.view
    if (!view) return el.textContent ?? ''

    return view.state.doc.toString() as string
  })
}

async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((nextContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CodeMirror view is attached to the DOM node.
    const view = (el as any).cmTile?.view
    if (!view) return

    const fullDocumentRange = { from: 0, to: view.state.doc.length }
    view.dispatch({
      changes: { ...fullDocumentRange, insert: nextContent },
    })
  }, content)
}

async function seedImageBlock(page: Page) {
  await openNote(page, 'Note B')
  await openRawMode(page)

  const rawContent = await getRawEditorContent(page)
  const imageMarkdown = `\n\n![Toolbar hover regression](${IMAGE_DATA_URL})\n`
  await setRawEditorContent(page, `${rawContent}${imageMarkdown}`)
  await page.waitForTimeout(700)

  await openBlockNoteMode(page)

  const image = page.locator('.bn-editor img.bn-visual-media').last()
  await expect(image).toBeVisible({ timeout: 5_000 })
  return image
}

async function moveMouseInSteps(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps, stepDelayMs }: { steps: number; stepDelayMs: number },
) {
  await page.mouse.move(from.x, from.y)

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    await page.mouse.move(
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
    )
    await page.waitForTimeout(stepDelayMs)
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('image toolbar stays usable while the pointer crosses onto its controls', async ({ page }) => {
  const image = await seedImageBlock(page)

  const toolbar = page.locator('.bn-formatting-toolbar')
  const replaceButton = page.getByRole('button', { name: /Replace image/i })

  const imageBox = await image.boundingBox()
  expect(imageBox).not.toBeNull()

  await page.mouse.move(
    imageBox!.x + imageBox!.width / 2,
    imageBox!.y + imageBox!.height / 2,
  )

  await expect(toolbar).toBeVisible({ timeout: 5_000 })
  await expect(replaceButton).toBeVisible()

  const replaceButtonBox = await replaceButton.boundingBox()
  expect(replaceButtonBox).not.toBeNull()

  await moveMouseInSteps(
    page,
    {
      x: imageBox!.x + imageBox!.width / 2,
      y: imageBox!.y + imageBox!.height / 2,
    },
    {
      x: replaceButtonBox!.x + replaceButtonBox!.width / 2,
      y: replaceButtonBox!.y + replaceButtonBox!.height / 2,
    },
    { steps: 12, stepDelayMs: 35 },
  )

  await expect(toolbar).toBeVisible()
  await expect(replaceButton).toBeVisible()

  await replaceButton.click()
  await expect(page.locator('.bn-panel-popover')).toBeVisible()
})
