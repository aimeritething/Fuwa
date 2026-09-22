import { expect, test } from '@playwright/test'
// Type-only: brings the fixture's `window.__plumoMockVault` declaration into the spec program.
import type { MockVault } from '../../src/platform/mock/vault-fixture'
import { watchForErrors } from './harness'

// The app boots to the empty window in a plain
// browser, with the Folder fixture answering the command boundary. Later specs
// seed the fixture through `window.__plumoMockVault` before navigating.

test('boots to the empty window with the Folder fixture installed', async ({ page }) => {
  const { pageErrors, consoleErrors } = watchForErrors(page)

  await page.goto('/')

  await expect(page).toHaveTitle('Plumo')
  await expect(page.locator('#root > *').first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const fixture = await page.evaluate(async () => {
    const vault: MockVault | undefined = window.__plumoMockVault
    if (!vault) return null
    const files = await vault.invoke('list_files', { vaultPath: vault.vaultPath })
    return { vaultPath: vault.vaultPath, fileCount: files.length, pendingOpen: await vault.invoke('take_pending_open') }
  })

  expect(fixture).not.toBeNull()
  expect(fixture?.fileCount).toBeGreaterThan(0)
  expect(fixture?.pendingOpen).toEqual([])
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})
