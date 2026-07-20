import { expect, test, type Page } from '@playwright/test'

const PRIMARY_VAULT = '/Users/mock/Field Notes'
const RESEARCH_VAULT = '/Users/mock/Research Lab'

type MockHandler = (args?: Record<string, unknown>) => unknown
type QuickLauncherTestWindow = Window & {
  __mockHandlers?: Record<string, MockHandler>
  __quickLauncherCapture?: { content: string; path: string; vaultPath: string }
  __quickLauncherSearchVaults?: string[]
  __laputaTest?: { quickLauncherOpenUrl?: string }
}

async function installQuickLauncherMocks(page: Page): Promise<void> {
  await page.addInitScript(({ primaryVault, researchVault }) => {
    localStorage.clear()
    const testWindow = window as QuickLauncherTestWindow
    testWindow.__quickLauncherSearchVaults = []
    const entries = {
      [primaryVault]: [{ path: `${primaryVault}/inbox/home.md`, title: 'Home Note' }],
      [researchVault]: [{ path: `${researchVault}/notes/beacon.md`, title: 'Research Beacon' }],
    }
    let handlers: Record<string, MockHandler> | undefined
    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      get: () => handlers,
      set(value: Record<string, MockHandler>) {
        handlers = value
        handlers.get_settings = () => ({ quick_capture_vault_path: primaryVault })
        handlers.load_vault_list = () => ({
          active_vault: primaryVault,
          default_workspace_path: primaryVault,
          hidden_defaults: [],
          vaults: [
            { alias: 'field', label: 'Field Notes', mounted: true, path: primaryVault },
            { alias: 'research', label: 'Research Lab', mounted: true, path: researchVault },
          ],
        })
        handlers.check_vault_exists = () => true
        handlers.list_vault_folders = () => [{ children: [], name: 'inbox', path: 'inbox' }]
        handlers.list_vault = (args) => entries[String(args?.path ?? '')] ?? []
        handlers.search_vault = (args) => {
          const vaultPath = String(args?.vaultPath ?? '')
          testWindow.__quickLauncherSearchVaults?.push(vaultPath)
          const matching = entries[vaultPath as keyof typeof entries] ?? []
          return {
            elapsed_ms: 1,
            results: matching.filter((entry) => entry.title.includes('Beacon')).map((entry) => ({
              match_category: 'title',
              path: entry.path,
              relative_path: entry.path.slice(vaultPath.length + 1),
              score: 30,
              snippet: 'Cross-vault result',
              title: entry.title,
            })),
          }
        }
        handlers.create_note_content = (args) => {
          testWindow.__quickLauncherCapture = {
            content: String(args?.content ?? ''),
            path: String(args?.path ?? ''),
            vaultPath: String(args?.vaultPath ?? ''),
          }
          return null
        }
      },
    })
  }, { primaryVault: PRIMARY_VAULT, researchVault: RESEARCH_VAULT })
}

test('global launcher searches across vaults and safely captures a note @smoke', async ({ page }) => {
  await installQuickLauncherMocks(page)
  await page.goto('/?window=quick-launcher', { waitUntil: 'domcontentloaded' })

  await page.getByLabel('Search every vault…').fill('Beacon')
  await expect(page.getByText('Research Beacon', { exact: true })).toBeVisible()
  await page.getByText('Research Beacon', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as QuickLauncherTestWindow).__laputaTest?.quickLauncherOpenUrl))
    .toBe('tolaria://research/notes/beacon.md')
  expect(new Set(await page.evaluate(() => (window as QuickLauncherTestWindow).__quickLauncherSearchVaults)))
    .toEqual(new Set([PRIMARY_VAULT, RESEARCH_VAULT]))

  await page.getByRole('tab', { name: 'Capture' }).click()
  await page.getByLabel('Title').fill('Launcher Meeting')
  await page.getByLabel('Body').fill('Decision captured outside the main window.')
  await expect(page.getByText(`Destination: ${PRIMARY_VAULT}/launcher-meeting.md`)).toBeVisible()
  await page.getByRole('button', { name: 'Save capture' }).click()

  await expect.poll(() => page.evaluate(() => (window as QuickLauncherTestWindow).__quickLauncherCapture))
    .toEqual({
      content: '# Launcher Meeting\n\nDecision captured outside the main window.\n',
      path: `${PRIMARY_VAULT}/launcher-meeting.md`,
      vaultPath: PRIMARY_VAULT,
    })
})
