import { expect, test, type Locator } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

const NOTE_TITLE = 'Blockquote Spacing'
const NOTE_CONTENT = `---
title: ${NOTE_TITLE}
type: Note
---

# ${NOTE_TITLE}

> First quoted paragraph.
>
> Second quoted paragraph.
`

let tempVaultDir: string
test.setTimeout(90_000)

async function expectContinuousQuoteRail(quotes: Locator): Promise<void> {
  await expect(quotes).toHaveCount(3)
  const layout = await quotes.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const content = element.parentElement
    if (!content) throw new Error('Expected blockquote content wrapper')
    const contentStyle = getComputedStyle(content)
    return {
      borderLeft: rect.left,
      bottom: rect.bottom,
      contentPaddingBottom: contentStyle.paddingBottom,
      contentPaddingTop: contentStyle.paddingTop,
      marginBottom: style.marginBottom,
      marginTop: style.marginTop,
      top: rect.top,
    }
  }))

  expect(layout.map(item => item.borderLeft)).toEqual([layout[0].borderLeft, layout[0].borderLeft, layout[0].borderLeft])
  expect(layout.slice(0, -1).map(item => item.marginBottom)).toEqual(['0px', '0px'])
  expect(layout.slice(1).map(item => item.marginTop)).toEqual(['0px', '0px'])
  expect(layout.slice(0, -1).map(item => item.contentPaddingBottom)).toEqual(['0px', '0px'])
  expect(layout.slice(1).map(item => item.contentPaddingTop)).toEqual(['0px', '0px'])
  expect(layout[1].top - layout[0].bottom).toBeLessThanOrEqual(1)
  expect(layout[2].top - layout[1].bottom).toBeLessThanOrEqual(1)
}

test('quoted blank lines render as one continuous quote after reload', async ({ page }) => {
  tempVaultDir = createFixtureVaultCopy()

  try {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    const response = await page.request.post('/api/vault/save', {
      data: { content: NOTE_CONTENT, path: `${tempVaultDir}/blockquote-spacing.md` },
    })
    expect(response.ok()).toBe(true)
    await triggerMenuCommand(page, 'vault-reload')
    await page.getByText(NOTE_TITLE, { exact: true }).first().click()
    await expectContinuousQuoteRail(page.locator('.bn-editor blockquote'))

    await page.reload()
    await page.locator('[data-testid="note-list-container"]').waitFor()
    await page.getByText(NOTE_TITLE, { exact: true }).first().click()
    await expectContinuousQuoteRail(page.locator('.bn-editor blockquote'))
  } finally {
    removeFixtureVaultCopy(tempVaultDir)
  }
})
