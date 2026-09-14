import { expect, test, type Page } from '@playwright/test'
// Type-only: brings the fixture's `window.__fuwaMockVault` declaration into the spec program.
import type { MockVault } from '../../src/platform/mock/vault-fixture'
import {
  MOCK_FOLDER, openDocumentThroughDialog, openFolderThroughDialog, queueFolderSelection, storedSession, watchForErrors, WELCOME_PATH,
} from './harness'

// An empty window always says what to do next: the four empty states, and
// the restore that lost its Folder.

const GONE_FOLDER = '/Users/fuwa/Documents/Gone'

const hints = (page: Page) => page.getByTestId('empty-hint').allTextContents()

test('a fresh install shows the No-Folder state: the indigo button, the one hint, no tab bar and no path row', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')

  const block = page.getByTestId('explorer-no-folder')
  await expect(block).toContainText('No folder open')
  await expect(block).toContainText('or drop a .md file onto the window')
  const button = page.getByRole('button', { name: 'Open Folder ⌘O' })
  await expect(button).toBeVisible()
  await expect(button).toHaveCSS('background-color', 'rgb(94, 105, 209)')
  await expect(page.getByTestId('explorer-folder-missing')).toHaveCount(0)
  await expect(page.getByTestId('editor-empty-state')).toContainText('Fuwa')
  expect(await hints(page)).toEqual(['⌘Oopen folder'])
  await expect(page.getByTestId('empty-hint')).toHaveCSS('font-family', /JetBrains Mono/)
  await expect(page.getByTestId('tab-bar')).toHaveCount(0)
  await expect(page.getByTestId('path-row')).toHaveCount(0)
  await expect(page.getByTestId('open-editors')).toHaveCount(0)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('clicking Open Folder ⌘O opens the dialog, and the Folder-open-no-Tab state shows the two hints', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await queueFolderSelection(page, MOCK_FOLDER)

  await page.getByRole('button', { name: 'Open Folder ⌘O' }).click()

  await expect(page.getByRole('tree')).toBeVisible()
  await expect(page.getByTestId('explorer-no-folder')).toHaveCount(0)
  await expect(page.getByTestId('open-editors')).toHaveCount(0)
  expect(await hints(page)).toEqual(['⌘Nnew document', '⌘Pquick open'])
  await expect(page.getByTestId('tab-bar')).toHaveCount(0)
  await expect(page.getByTestId('path-row')).toHaveCount(0)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('a Folder with no .md under it says No documents yet, and the line goes with the first ⌘N', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await openFolderThroughDialog(page, `${MOCK_FOLDER}/Attachments`)

  const line = page.getByTestId('explorer-no-documents')
  await expect(line).toHaveText('No documents yet · ⌘N')
  await expect(page.getByRole('tree')).toContainText('lake.png')
  await expect(page.getByRole('button', { name: /Open Folder/ })).toHaveCount(0)

  await page.keyboard.press('Meta+n')

  await expect(page.getByTestId(`tab:${MOCK_FOLDER}/Attachments/Untitled.md`)).toBeVisible()
  await expect(line).toHaveCount(0)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('a relaunch whose Folder is gone says so above the button, writes folder: null and restores the surviving Tabs', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await page.evaluate(([folder, welcome]) => {
    const vault: MockVault | undefined = window.__fuwaMockVault
    if (!vault) throw new Error('The Folder fixture is not installed')
    vault.seedSession({
      version: 1,
      folder,
      openEditors: [{ path: welcome, mode: 'rich' }],
      activePath: welcome,
      theme: 'dark',
      sidebar: { collapsed: false, width: 260 },
    })
  }, [GONE_FOLDER, WELCOME_PATH] as const)

  await page.reload()

  const missing = page.getByTestId('explorer-folder-missing')
  await expect(missing).toHaveText(`Folder not found: ${GONE_FOLDER}`)
  const block = page.getByTestId('explorer-no-folder')
  await expect(block).toContainText('No folder open')
  const missingBox = (await missing.boundingBox())!
  const buttonBox = (await page.getByRole('button', { name: 'Open Folder ⌘O' }).boundingBox())!
  expect(missingBox.y + missingBox.height).toBeLessThanOrEqual(buttonBox.y)
  await expect(page.getByRole('tab', { name: 'Welcome.md' })).toBeVisible()
  await expect(page.locator('.bn-editor h1')).toHaveText('Welcome')
  // Open Editors above the Explorer, the Document's parent dimmed after its name.
  await expect(page.getByTestId(`open-editor:${WELCOME_PATH}`).locator('.fuwa-sidebar-row__parent')).toHaveText('Notes')
  await expect.poll(() => storedSession(page)).toMatchObject({ folder: null, openEditors: [{ path: WELCOME_PATH, mode: 'rich' }] })

  // The line stays until any Folder is opened.
  await openFolderThroughDialog(page, MOCK_FOLDER)
  await expect(missing).toHaveCount(0)
  expect(errors.pageErrors).toEqual([])
  expect(errors.consoleErrors).toEqual([])
})

test('the Tabs of a Folder-less window open into a collapsed sidebar, which holds Open Editors over the No-Folder block once shown', async ({ page }) => {
  await page.goto('/')
  await openDocumentThroughDialog(page, WELCOME_PATH)

  await expect(page.getByTestId('sidebar')).toHaveCount(0)
  await page.keyboard.press('Meta+BracketLeft')

  const sidebar = page.getByTestId('sidebar')
  const openEditors = page.getByTestId('open-editors')
  const explorer = page.getByTestId('explorer-no-folder')
  await expect(openEditors).toBeVisible()
  await expect(explorer).toBeVisible()
  expect((await openEditors.boundingBox())!.y).toBeLessThan((await explorer.boundingBox())!.y)
  await expect(sidebar.getByRole('option')).toHaveCount(1)
})
