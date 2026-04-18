import { test, expect, type Page } from '@playwright/test'

interface MockEntry {
  path: string
  filename: string
  title: string
  isA: string
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  archived: boolean
  modifiedAt: number | null
  createdAt: number | null
  fileSize: number
  snippet: string
  wordCount: number
  relationships: Record<string, string[]>
  outgoingLinks: string[]
  properties: Record<string, unknown>
  template: null
  sort: null
}

async function installVaultSwitcherMocks(page: Page) {
  await page.addInitScript(() => {
    const workVaultPath = '/Users/mock/Work'
    const personalVaultPath = '/Users/mock/Personal'
    const gettingStartedPath = '/Users/mock/Documents/Getting Started'

    const entriesByVault = {
      [gettingStartedPath]: [({
        path: `${gettingStartedPath}/getting-started.md`,
        filename: 'getting-started.md',
        title: 'Getting Started Note',
        isA: 'Note',
        aliases: [],
        belongsTo: [],
        relatedTo: [],
        status: null,
        archived: false,
        modifiedAt: 1700000000,
        createdAt: null,
        fileSize: 256,
        snippet: 'Getting Started snippet',
        wordCount: 12,
        relationships: {},
        outgoingLinks: [],
        properties: {},
        template: null,
        sort: null,
      })],
      [workVaultPath]: [({
        path: `${workVaultPath}/work-home.md`,
        filename: 'work-home.md',
        title: 'Work Home',
        isA: 'Note',
        aliases: [],
        belongsTo: [],
        relatedTo: [],
        status: null,
        archived: false,
        modifiedAt: 1700000000,
        createdAt: null,
        fileSize: 256,
        snippet: 'Work Home snippet',
        wordCount: 12,
        relationships: {},
        outgoingLinks: [],
        properties: {},
        template: null,
        sort: null,
      })],
      [personalVaultPath]: [({
        path: `${personalVaultPath}/personal-home.md`,
        filename: 'personal-home.md',
        title: 'Personal Home',
        isA: 'Note',
        aliases: [],
        belongsTo: [],
        relatedTo: [],
        status: null,
        archived: false,
        modifiedAt: 1700000000,
        createdAt: null,
        fileSize: 256,
        snippet: 'Personal Home snippet',
        wordCount: 12,
        relationships: {},
        outgoingLinks: [],
        properties: {},
        template: null,
        sort: null,
      })],
    } satisfies Record<string, MockEntry[]>

    const allContent = Object.fromEntries(
      Object.values(entriesByVault)
        .flat()
        .map((entry) => [entry.path, `# ${entry.title}\n\n${entry.snippet}`]),
    )

    localStorage.clear()
    localStorage.setItem('tolaria:claude-code-onboarding-dismissed', '1')

    let ref: Record<string, unknown> | null = null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>
        ref.load_vault_list = () => ({
          vaults: [
            { label: 'Work Vault', path: workVaultPath },
            { label: 'Personal Vault', path: personalVaultPath },
          ],
          active_vault: workVaultPath,
          hidden_defaults: [],
        })
        ref.get_default_vault_path = () => gettingStartedPath
        ref.check_vault_exists = (args: { path?: string }) => typeof args?.path === 'string' && args.path.length > 0
        ref.list_vault = (args: { path?: string }) => entriesByVault[args?.path ?? ''] ?? []
        ref.list_vault_folders = () => []
        ref.list_views = () => []
        ref.get_all_content = () => allContent
        ref.get_note_content = (args: { path?: string }) => allContent[args?.path ?? ''] ?? ''
        ref.get_modified_files = () => []
        ref.get_file_history = () => []
      },
      get() {
        return ref
      },
    })
  })
}

test('bottom bar vault switching works with keyboard and mouse @smoke', async ({ page }) => {
  await installVaultSwitcherMocks(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByTestId('status-vault-trigger')
  const noteList = page.getByTestId('note-list-container')

  await expect(trigger).toContainText('Work Vault')
  await expect(noteList.getByText('Work Home', { exact: true })).toBeVisible()

  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('vault-menu-item-Getting Started')).toBeFocused()
  await page.getByTestId('vault-menu-item-Personal Vault').focus()
  await expect(page.getByTestId('vault-menu-item-Personal Vault')).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(trigger).toContainText('Personal Vault')
  await expect(noteList.getByText('Personal Home', { exact: true })).toBeVisible()
  await expect(noteList.getByText('Work Home', { exact: true })).toHaveCount(0)

  await trigger.click()
  await page.getByTestId('vault-menu-item-Work Vault').click()

  await expect(trigger).toContainText('Work Vault')
  await expect(noteList.getByText('Work Home', { exact: true })).toBeVisible()
  await expect(noteList.getByText('Personal Home', { exact: true })).toHaveCount(0)
})
