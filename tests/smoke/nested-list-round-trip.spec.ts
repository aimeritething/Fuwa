import { expect, test } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

const NOTE_TITLE = 'Nested List Round Trip'
const NESTED_LIST = [
  '1. This is a multi-paragraph point in Markdown.',
  '',
  '   ```typescript',
  '   "just a codeblock for illustration"',
  '   ```',
  '',
  '   This continuation is still part of point 1.',
  '',
  '2. Second item.',
].join('\n')

let tempVaultDir: string
let notePath: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  notePath = `${tempVaultDir}/nested-list-round-trip.md`
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
  const response = await page.request.post('/api/vault/save', {
    data: { content: `# ${NOTE_TITLE}\n\n${NESTED_LIST}\n\nUnrelated edit target.\n`, path: notePath },
  })
  expect(response.ok()).toBe(true)
  await triggerMenuCommand(page, 'vault-reload')
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke nested list continuations render and survive unrelated edits', async ({ page }) => {
  await page.getByText(NOTE_TITLE, { exact: true }).first().click()
  const numberedItems = page.locator('[data-content-type="numberedListItem"]')
  await expect(numberedItems).toHaveCount(2)

  const firstItem = numberedItems.first().locator('xpath=ancestor::div[contains(@class,"bn-block-outer")][1]')
  await expect(firstItem.locator('[data-content-type="codeBlock"]')).toContainText(
    'just a codeblock for illustration',
  )
  await expect(firstItem).toContainText('This continuation is still part of point 1.')

  const unrelatedParagraph = page.locator('[data-content-type="paragraph"]', {
    hasText: 'Unrelated edit target.',
  })
  await unrelatedParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Updated.')
  await triggerMenuCommand(page, 'file-save')

  await expect.poll(async () => {
    const response = await page.request.get(`/api/vault/content?path=${encodeURIComponent(notePath)}`)
    return (await response.json() as { content: string }).content
  }).toContain(`${NESTED_LIST}\n\nUnrelated edit target. Updated.`)
})
