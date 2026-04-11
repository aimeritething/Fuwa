import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVaultTauri, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

let tempVaultDir: string

function trackUnexpectedErrors(page: Page): string[] {
  const errors: string[] = []

  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('ws://localhost:9711')) return
    errors.push(text)
  })

  return errors
}

async function createUntitledNote(page: Page): Promise<void> {
  await triggerMenuCommand(page, 'file-new-note')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    return Boolean(active?.isContentEditable || active?.closest('[contenteditable="true"]'))
  }), {
    timeout: 5_000,
  }).toBe(true)
}

async function insertTable(page: Page): Promise<void> {
  const editorSurface = page.locator('.bn-editor')
  await expect(editorSurface).toBeVisible({ timeout: 5_000 })
  await editorSurface.click()
  await page.keyboard.type('/table')

  const tableCommand = page.getByText('Table with editable cells', { exact: true })
  await expect(tableCommand).toBeVisible({ timeout: 5_000 })
  await tableCommand.click()

  await expect(page.locator('table')).toHaveCount(1, { timeout: 5_000 })
}

async function dragFirstColumn(page: Page, deltaX: number): Promise<void> {
  const firstCell = page.locator('table td, table th').first()
  await expect(firstCell).toBeVisible({ timeout: 5_000 })

  const box = await firstCell.boundingBox()
  if (!box) throw new Error('Could not measure first table cell')

  const handleX = box.x + box.width - 1
  const handleY = box.y + (box.height / 2)

  await page.mouse.move(handleX, handleY)
  await expect(page.locator('.column-resize-handle')).toHaveCount(2, { timeout: 5_000 })
  await page.mouse.down()
  await page.mouse.move(handleX + deltaX, handleY, { steps: 8 })
  await page.mouse.up()
}

test.describe('table resize crash fix', () => {
  test.beforeEach((_, testInfo) => {
    testInfo.setTimeout(60_000)
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('resizing a table column keeps the editor stable and changes the cell width', async ({ page }) => {
    const errors = trackUnexpectedErrors(page)

    await openFixtureVaultTauri(page, tempVaultDir)
    await createUntitledNote(page)
    await insertTable(page)

    const firstCell = page.locator('table td, table th').first()
    const before = await firstCell.boundingBox()
    if (!before) throw new Error('Could not measure first table cell before resize')

    await dragFirstColumn(page, 80)

    const after = await firstCell.boundingBox()
    if (!after) throw new Error('Could not measure first table cell after resize')

    expect(after.width).toBeGreaterThan(before.width)
    await expect(page.locator('table')).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('unmounting the editor mid-resize does not surface stale ProseMirror view errors', async ({ page }) => {
    const errors = trackUnexpectedErrors(page)

    await openFixtureVaultTauri(page, tempVaultDir)
    await createUntitledNote(page)
    await insertTable(page)

    const firstCell = page.locator('table td, table th').first()
    await expect(firstCell).toBeVisible({ timeout: 5_000 })

    const box = await firstCell.boundingBox()
    if (!box) throw new Error('Could not measure first table cell before resize')

    const handleX = box.x + box.width - 1
    const handleY = box.y + (box.height / 2)

    await page.mouse.move(handleX, handleY)
    await expect(page.locator('.column-resize-handle')).toHaveCount(2, { timeout: 5_000 })
    await page.mouse.down()
    await page.keyboard.press('Meta+Backslash')
    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
    await page.mouse.move(handleX + 80, handleY, { steps: 8 })
    await page.mouse.up()

    expect(errors).toEqual([])
  })
})
