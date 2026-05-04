import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVaultTauri, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

let tempVaultDir: string

function activeNotePath(): string {
  return path.join(tempVaultDir, 'project', 'alpha-project.md')
}

async function dispatchClipboardImagePaste(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = document.querySelector<HTMLElement>(
      '.bn-editor [data-content-type="paragraph"] .bn-inline-content',
    )
    if (!target) throw new Error('Editor paste target was not found')

    const file = new File(
      [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00])],
      'reported.webp',
      { type: 'image/webp' },
    )
    const items = [{
      getAsFile: () => file,
      kind: 'file',
      type: 'image/webp',
    }]
    const files = [file]
    const clipboardData = {
      files: Object.assign(files, { item: (index: number) => files[index] }),
      getData: (format: string) => format === 'text/plain' ? 'data:image/webp;base64,UklGRgAAAAA=' : '',
      items: Object.assign(items, { length: items.length }),
      types: ['text/plain', 'Files'],
    }

    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: clipboardData })

    if (target.dispatchEvent(event)) {
      throw new Error('Clipboard image paste was not intercepted')
    }
  })
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultTauri(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('clipboard WebP paste uses the attachment image flow instead of raw text', async ({ page }) => {
  await page.getByText('Alpha Project', { exact: true }).first().click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('textbox').last().click()
  await page.evaluate(() => {
    type MockHandlersWindow = Window & typeof globalThis & {
      __mockHandlers?: Record<string, (args?: Record<string, unknown>) => unknown>
      __TAURI_INTERNALS__?: {
        convertFileSrc?: (filePath: string, protocol?: string) => string
      }
      __pasteSaveImageCalls?: number
    }
    const mockWindow = window as MockHandlersWindow
    const mockHandlers = mockWindow.__mockHandlers
    if (!mockHandlers) throw new Error('Mock handlers were not installed')
    if (!mockWindow.__TAURI_INTERNALS__) throw new Error('Tauri internals were not installed')
    mockWindow.__TAURI_INTERNALS__.convertFileSrc = (filePath, protocol = 'asset') => (
      `${protocol}://localhost/${encodeURIComponent(filePath)}`
    )
    mockHandlers.save_image = (args) => {
      mockWindow.__pasteSaveImageCalls = (mockWindow.__pasteSaveImageCalls ?? 0) + 1
      const vaultPath = String(args?.vaultPath ?? args?.vault_path ?? '')
      const filename = String(args?.filename ?? 'clipboard-image.webp')
      return `${vaultPath}/attachments/123-${filename}`
    }
  })

  await dispatchClipboardImagePaste(page)
  await expect.poll(() => page.evaluate(() => {
    type PasteWindow = Window & typeof globalThis & { __pasteSaveImageCalls?: number }
    return (window as PasteWindow).__pasteSaveImageCalls ?? 0
  }), { timeout: 5_000 }).toBe(1)
  await expect(page.locator('.bn-editor img')).toHaveCount(1, { timeout: 5_000 })

  await triggerMenuCommand(page, 'file-save')
  await expect.poll(() => fs.readFileSync(activeNotePath(), 'utf8'), {
    timeout: 10_000,
  }).toMatch(/!\[[^\]]*\]\(attachments\/[^)\s]*reported\.webp\)/)

  const savedMarkdown = fs.readFileSync(activeNotePath(), 'utf8')
  expect(savedMarkdown).not.toContain('data:image/webp')
})
