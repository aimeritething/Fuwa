import { test, expect, type Page } from '@playwright/test'
import { sendShortcut } from './helpers'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

async function selectSection(page: Page, label: string): Promise<void> {
  await page.locator('aside').getByText(label, { exact: true }).first().click()
}

async function createNoteFromListHeader(page: Page): Promise<void> {
  await page.locator('button[title="Create new note"]').click()
}

function untitledRow(page: Page, typeLabel: string) {
  return page.getByText(new RegExp(`^Untitled ${typeLabel}(?: \\d+)?$`, 'i')).first()
}

test.describe('Create note crash fix', () => {
  test.beforeEach(async ({ page }) => {
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVault(page, tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('clicking + next to a type section creates a note without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await selectSection(page, 'Projects')
    await createNoteFromListHeader(page)
    await expect(untitledRow(page, 'project')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Cmd+N creates a note without crashing @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])
    await expect(untitledRow(page, 'note')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('creating note for custom type does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await selectSection(page, 'Events')
    await createNoteFromListHeader(page)
    await expect(untitledRow(page, 'event')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })
})
