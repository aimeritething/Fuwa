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
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.endsWith('/api/vault/ping')) return Promise.resolve(new Response('', { status: 503 }))
      return nativeFetch(input, init)
    }
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
          const query = String(args?.query ?? '').toLocaleLowerCase()
          testWindow.__quickLauncherSearchVaults?.push(vaultPath)
          const matching = entries[vaultPath as keyof typeof entries] ?? []
          return {
            elapsed_ms: 1,
            results: matching.filter((entry) => entry.title.toLocaleLowerCase().includes(query)).map((entry) => ({
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

  const launcherInput = page.getByLabel('Search notes or create one…')
  await launcherInput.fill('Beacon')
  await expect(page.getByText('Research Beacon', { exact: true })).toBeVisible()
  await page.getByText('Research Beacon', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as QuickLauncherTestWindow).__laputaTest?.quickLauncherOpenUrl))
    .toBe('tolaria://research/notes/beacon.md')
  expect(new Set(await page.evaluate(() => (window as QuickLauncherTestWindow).__quickLauncherSearchVaults)))
    .toEqual(new Set([PRIMARY_VAULT, RESEARCH_VAULT]))

  await launcherInput.fill('Launcher Meeting')
  await expect(page.getByRole('button', { name: 'Create note "Launcher Meeting"' })).toBeVisible()
  await page.getByLabel('Save to vault').click()
  await page.getByRole('option', { name: 'Research Lab' }).click()
  await launcherInput.press('Enter')

  await expect.poll(() => page.evaluate(() => (window as QuickLauncherTestWindow).__quickLauncherCapture))
    .toEqual({
      content: '# Launcher Meeting\n',
      path: `${RESEARCH_VAULT}/launcher-meeting.md`,
      vaultPath: RESEARCH_VAULT,
    })
})
