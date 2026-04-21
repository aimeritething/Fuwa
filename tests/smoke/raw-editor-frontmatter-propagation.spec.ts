import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

const PROJECT_NOTE_PATH = path.join('project', 'alpha-project.md')
const PROJECT_NOTE_CONTENT = `---
Is A: Project
Status: Done
Owner:
  - "[[Note B]]"
Related to:
  - "[[Note B]]"
  - "[[Note C]]"
---

# Alpha Project

This is a test project that references other notes.

## Notes

See [[Note B]] for details and [[Note C]] for additional context.
`

let tempVaultDir: string

async function openAlphaProject(page: Page, notePath: string): Promise<void> {
  const row = page.locator(`[data-note-path="${notePath}"]`)
  await expect(row).toBeVisible({ timeout: 5_000 })
  await row.click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function showStatusChipInInbox(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('laputa:open-note-list-properties', {
      detail: { scope: 'inbox' },
    }))
  })
  await expect(page.getByTestId('list-properties-popover')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('checkbox', { name: 'status' }).click()
  await page.keyboard.press('Escape')
}

async function openRawEditor(page: Page): Promise<void> {
  await page.keyboard.press('Control+Backslash')
  await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
}

async function replaceRawEditorContent(page: Page, nextContent: string): Promise<void> {
  await page.evaluate((content) => {
    const host = document.querySelector('.cm-content')
    if (!host) {
      throw new Error('CodeMirror content element is missing')
    }

    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: { doc: { length: number } }
          dispatch(transaction: { changes: { from: number; to: number; insert: string } }): void
        }
      }
    }

    const view = (host as CodeMirrorHost).cmTile?.view
    if (!view) {
      throw new Error('CodeMirror view is missing')
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    })
  }, nextContent)
}

test.describe('Raw editor frontmatter propagation', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('raw frontmatter edits immediately update inspector relationships and note-list chips @smoke', async ({ page }) => {
    const notePath = path.join(tempVaultDir, PROJECT_NOTE_PATH)

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await showStatusChipInInbox(page)

    const noteRow = page.locator(`[data-note-path="${notePath}"]`)
    await expect(noteRow.getByTestId('property-chip-status-0')).toHaveText('• Active')

    await openAlphaProject(page, notePath)
    await openRawEditor(page)
    await replaceRawEditorContent(page, PROJECT_NOTE_CONTENT)
    await page.waitForTimeout(800)
    await page.keyboard.press('Control+Shift+i')

    await expect(
      page.locator('[data-testid="editable-property"]').filter({ hasText: 'Owner' }),
    ).toHaveCount(0)
    await expect(
      page.getByTestId('relationships-panel-grid').getByText('Owner', { exact: true }),
    ).toBeVisible()
    await expect(noteRow.getByTestId('property-chip-status-0')).toHaveText('• Done')
  })
})
