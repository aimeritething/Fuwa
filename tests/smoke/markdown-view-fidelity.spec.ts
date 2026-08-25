import { expect, test, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

const NOTE_TITLE = 'Markdown Fidelity Regression'
const NOTE_SOURCE = [
  '---',
  `title: ${NOTE_TITLE}`,
  '---',
  'Keep STALE_SECONDS, item_key, and ALL_VERSIONS searchable.',
  '',
  String.raw`Path: {BackupType}\{ServerName}$\{InstanceName}\{DatabaseName}`,
  '',
  'Function-URL event shapes. **Cloudflare Access JWT still verified in pure stdlib**',
  '(`jwt_verify.py`, RS256 vs team JWKS) as defense-in-depth.',
  '',
].join('\n')
const EDITED_NOTE_SOURCE = NOTE_SOURCE.replace('searchable.', 'searchable.x')

interface MarkdownSaveProbeWindow {
  __markdownSaveProbe?: Array<{ content: string; path: string }>
}

let tempVaultDir: string

async function installSaveProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probeWindow = window as typeof window & MarkdownSaveProbeWindow
    const nativeFetch = window.fetch.bind(window)
    const calls: Array<{ content: string; path: string }> = []
    probeWindow.__markdownSaveProbe = calls
    const requestUrl = (input: RequestInfo | URL) => {
      if (typeof input === 'string') return input
      if (input instanceof Request) return input.url
      return input.toString()
    }
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (requestUrl(input).endsWith('/api/vault/save')) {
        const body = JSON.parse(String(init?.body ?? '')) as { content?: unknown; path?: unknown }
        calls.push({ content: String(body.content ?? ''), path: String(body.path ?? '') })
      }
      return nativeFetch(input, init)
    }
  })
}

async function savedMarkdown(page: Page): Promise<Array<{ content: string; path: string }>> {
  return page.evaluate(() => {
    const probeWindow = window as typeof window & MarkdownSaveProbeWindow
    return probeWindow.__markdownSaveProbe ?? []
  })
}

async function clearSavedMarkdown(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probeWindow = window as typeof window & MarkdownSaveProbeWindow
    probeWindow.__markdownSaveProbe?.splice(0)
  })
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
  await installSaveProbe(page)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke viewing and saving infrastructure Markdown preserves its source', async ({ page }) => {
  await triggerMenuCommand(page, 'file-new-note')
  await page.getByRole('button', { name: 'Open the raw editor' }).click()
  const rawEditor = page.locator('.cm-content')
  await expect(rawEditor).toBeVisible({ timeout: 10_000 })
  await rawEditor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(NOTE_SOURCE)
  await expect.poll(() => savedMarkdown(page), { timeout: 10_000 }).toEqual(
    expect.arrayContaining([expect.objectContaining({ content: NOTE_SOURCE })]),
  )

  await clearSavedMarkdown(page)
  await page.getByRole('button', { name: 'Return to the editor' }).click()
  const paragraph = page.locator('.bn-block-content[data-content-type="paragraph"]')
    .filter({ hasText: 'Keep STALE_SECONDS' })
  await expect(paragraph).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(3_200)
  expect(await savedMarkdown(page)).toEqual([
    expect.objectContaining({ content: NOTE_SOURCE }),
  ])
  await clearSavedMarkdown(page)

  await paragraph.locator('.bn-inline-content').click()
  await page.keyboard.press('End')
  await page.keyboard.type('x')

  await expect.poll(() => savedMarkdown(page), { timeout: 10_000 }).toEqual([
    expect.objectContaining({ content: EDITED_NOTE_SOURCE }),
  ])
})
