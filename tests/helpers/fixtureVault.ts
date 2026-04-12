import { expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const FIXTURE_VAULT = path.resolve('tests/fixtures/test-vault')
const FIXTURE_VAULT_READY_TIMEOUT = 30_000
const FIXTURE_VAULT_REMOVE_RETRIES = 10
const FIXTURE_VAULT_REMOVE_RETRY_DELAY_MS = 100

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, item.name)
    const destinationPath = path.join(dest, item.name)
    if (item.isDirectory()) {
      copyDirSync(sourcePath, destinationPath)
      continue
    }
    fs.copyFileSync(sourcePath, destinationPath)
  }
}

export function createFixtureVaultCopy(): string {
  const tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laputa-test-vault-'))
  copyDirSync(FIXTURE_VAULT, tempVaultDir)
  return tempVaultDir
}

export function removeFixtureVaultCopy(tempVaultDir: string | null | undefined): void {
  if (!tempVaultDir) return
  fs.rmSync(tempVaultDir, {
    recursive: true,
    force: true,
    maxRetries: FIXTURE_VAULT_REMOVE_RETRIES,
    retryDelay: FIXTURE_VAULT_REMOVE_RETRY_DELAY_MS,
  })
}

export async function openFixtureVault(
  page: Page,
  vaultPath: string,
): Promise<void> {
  await page.addInitScript((resolvedVaultPath: string) => {
    localStorage.clear()

    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()

      if (requestUrl.endsWith('/api/vault/ping') || requestUrl.includes('/api/vault/ping?')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      return nativeFetch(input, init)
    }

    const applyFixtureVaultOverrides = (
      handlers: Record<string, ((args?: unknown) => unknown)> | null | undefined,
    ) => {
      if (!handlers) return handlers
      handlers.load_vault_list = () => ({
        vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
        active_vault: resolvedVaultPath,
        hidden_defaults: [],
      })
      handlers.check_vault_exists = () => true
      handlers.get_last_vault_path = () => resolvedVaultPath
      handlers.get_default_vault_path = () => resolvedVaultPath
      handlers.save_vault_list = () => null
      return handlers
    }

    let ref = applyFixtureVaultOverrides(
      (window.__mockHandlers as Record<string, ((args?: unknown) => unknown)> | undefined),
    ) ?? null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = applyFixtureVaultOverrides(
          value as Record<string, ((args?: unknown) => unknown)> | undefined,
        ) ?? null
      },
      get() {
        return applyFixtureVaultOverrides(ref) ?? ref
      },
    })
  }, vaultPath)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.__mockHandlers))
  await page.evaluate((resolvedVaultPath: string) => {
    const handlers = window.__mockHandlers
    if (!handlers) {
      throw new Error('Mock handlers unavailable for fixture vault override')
    }

    handlers.load_vault_list = () => ({
      vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
      active_vault: resolvedVaultPath,
      hidden_defaults: [],
    })
    handlers.check_vault_exists = () => true
    handlers.get_last_vault_path = () => resolvedVaultPath
    handlers.get_default_vault_path = () => resolvedVaultPath
    handlers.save_vault_list = () => null
  }, vaultPath)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="note-list-container"]').waitFor({ timeout: FIXTURE_VAULT_READY_TIMEOUT })
  await expect(page.getByText('Alpha Project', { exact: true }).first()).toBeVisible({
    timeout: FIXTURE_VAULT_READY_TIMEOUT,
  })
}

/**
 * Browser harness for desktop command-routing tests.
 *
 * This stubs the Tauri invoke bridge inside Playwright so tests can exercise
 * renderer shortcut dispatch and desktop menu-command dispatch without a native
 * shell. It is deterministic, but it is not a substitute for real native QA.
 */
export async function openFixtureVaultDesktopHarness(
  page: Page,
  vaultPath: string,
): Promise<void> {
  await openFixtureVault(page, vaultPath)
  await page.evaluate((resolvedVaultPath: string) => {
    const jsonHeaders = { 'Content-Type': 'application/json' }
    const nativeFetch = window.fetch.bind(window)

    const FRONTMATTER_OPEN = '---\n'
    const FRONTMATTER_CLOSE = '\n---\n'

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const splitFrontmatter = (content: string) => {
      if (!content.startsWith(FRONTMATTER_OPEN)) {
        return { frontmatter: null as string | null, body: content }
      }

      const closeIndex = content.indexOf(FRONTMATTER_CLOSE, FRONTMATTER_OPEN.length)
      if (closeIndex === -1) {
        return { frontmatter: null as string | null, body: content }
      }

      return {
        frontmatter: content.slice(FRONTMATTER_OPEN.length, closeIndex),
        body: content.slice(closeIndex + FRONTMATTER_CLOSE.length),
      }
    }

    const splitFrontmatterEntries = (frontmatter: string) => {
      const lines = frontmatter.split('\n')
      const entries: Array<{ key: string; lines: string[] }> = []
      let current: { key: string; lines: string[] } | null = null

      for (const line of lines) {
        const match = line.match(/^([^:\n]+):(.*)$/)
        if (match && !line.startsWith(' ')) {
          if (current) entries.push(current)
          current = { key: match[1].trim(), lines: [line] }
          continue
        }

        if (current) {
          current.lines.push(line)
        } else if (line.trim() !== '') {
          current = { key: '', lines: [line] }
        }
      }

      if (current) entries.push(current)
      return entries
    }

    const serializeFrontmatterValue = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        if (value.length === 0) return ['[]']
        return [''].concat(value.map((item) => `  - ${JSON.stringify(String(item))}`))
      }
      if (typeof value === 'boolean' || typeof value === 'number') {
        return [String(value)]
      }
      return [JSON.stringify(String(value ?? ''))]
    }

    const replaceFrontmatterEntry = (content: string, key: string, value: unknown) => {
      const { frontmatter, body } = splitFrontmatter(content)
      const entryLines = serializeFrontmatterValue(value)
      const nextEntryLines =
        entryLines[0] === ''
          ? [`${key}:`, ...entryLines.slice(1)]
          : [`${key}: ${entryLines[0]}`]

      if (frontmatter === null) {
        return `${FRONTMATTER_OPEN}${nextEntryLines.join('\n')}${FRONTMATTER_CLOSE}${body}`
      }

      const entries = splitFrontmatterEntries(frontmatter).filter((entry) => entry.key !== '')
      const keyPattern = new RegExp(`^${escapeRegExp(key)}$`)
      let replaced = false
      const nextEntries = entries.map((entry) => {
        if (!keyPattern.test(entry.key)) return entry
        replaced = true
        return { key, lines: nextEntryLines }
      })

      if (!replaced) {
        nextEntries.push({ key, lines: nextEntryLines })
      }

      return `${FRONTMATTER_OPEN}${nextEntries.flatMap((entry) => entry.lines).join('\n')}${FRONTMATTER_CLOSE}${body}`
    }

    const removeFrontmatterEntry = (content: string, key: string) => {
      const { frontmatter, body } = splitFrontmatter(content)
      if (frontmatter === null) return content

      const keyPattern = new RegExp(`^${escapeRegExp(key)}$`)
      const nextEntries = splitFrontmatterEntries(frontmatter)
        .filter((entry) => entry.key !== '' && !keyPattern.test(entry.key))

      if (nextEntries.length === 0) {
        return body
      }

      return `${FRONTMATTER_OPEN}${nextEntries.flatMap((entry) => entry.lines).join('\n')}${FRONTMATTER_CLOSE}${body}`
    }

    const persistFrontmatterChange = async (path: string, transform: (content: string) => string) => {
      const current = await readJson(`/api/vault/content?path=${encodeURIComponent(path)}`) as { content: string }
      const updatedContent = transform(current.content)
      await readJson('/api/vault/save', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ path, content: updatedContent }),
      })
      return updatedContent
    }

    const readJson = async (url: string, init?: RequestInit) => {
      const response = await nativeFetch(url, init)
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const body = await response.json() as { error?: string }
          message = body.error ?? message
        } catch {
          // Keep the HTTP status fallback when the body is not JSON.
        }
        throw new Error(message)
      }
      return response.json()
    }

    const activeVaultList = {
      vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
      active_vault: resolvedVaultPath,
      hidden_defaults: [],
    }

    const readVaultList = (commandArgs?: Record<string, unknown>, reload = false) => {
      const resolvedPath = String(commandArgs?.path ?? resolvedVaultPath)
      return readJson(
        `/api/vault/list?path=${encodeURIComponent(resolvedPath)}&reload=${reload ? '1' : '0'}`,
      )
    }

    const renameNoteRequest = (payload: Record<string, unknown>) =>
      readJson('/api/vault/rename', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })

    const commandHandlers: Record<string, (commandArgs?: Record<string, unknown>) => Promise<unknown> | unknown> = {
      trigger_menu_command: (commandArgs) => {
        const commandId = String(commandArgs?.id ?? '')
        const bridge = window.__laputaTest?.dispatchBrowserMenuCommand
        if (!bridge) throw new Error('Tolaria test bridge is missing dispatchBrowserMenuCommand')
        bridge(commandId)
        return null
      },
      load_vault_list: () => activeVaultList,
      check_vault_exists: () => true,
      is_git_repo: () => true,
      get_last_vault_path: () => resolvedVaultPath,
      get_default_vault_path: () => resolvedVaultPath,
      save_vault_list: () => null,
      save_settings: () => null,
      register_mcp_tools: () => null,
      reinit_telemetry: () => null,
      update_menu_state: () => null,
      get_settings: () => ({
        auto_pull_interval_minutes: 5,
        telemetry_consent: false,
        crash_reporting_enabled: null,
        analytics_enabled: null,
        anonymous_id: null,
        release_channel: null,
      }),
      list_vault: (commandArgs) => readVaultList(commandArgs),
      reload_vault: (commandArgs) => readVaultList(commandArgs, true),
      list_vault_folders: () => [],
      list_views: () => [],
      get_modified_files: () => [],
      detect_renames: () => [],
      reload_vault_entry: (commandArgs) =>
        readJson(`/api/vault/entry?path=${encodeURIComponent(String(commandArgs?.path ?? ''))}`),
      get_note_content: async (commandArgs) => {
        const data = await readJson(
          `/api/vault/content?path=${encodeURIComponent(String(commandArgs?.path ?? ''))}`,
        ) as { content: string }
        return data.content
      },
      get_all_content: (commandArgs) =>
        readJson(
          `/api/vault/all-content?path=${encodeURIComponent(String(commandArgs?.path ?? resolvedVaultPath))}`,
        ),
      save_note_content: (commandArgs) =>
        readJson('/api/vault/save', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ path: commandArgs?.path, content: commandArgs?.content }),
        }),
      update_frontmatter: (commandArgs) =>
        persistFrontmatterChange(
          String(commandArgs?.path ?? ''),
          (content) => replaceFrontmatterEntry(content, String(commandArgs?.key ?? ''), commandArgs?.value),
        ),
      delete_frontmatter_property: (commandArgs) =>
        persistFrontmatterChange(
          String(commandArgs?.path ?? ''),
          (content) => removeFrontmatterEntry(content, String(commandArgs?.key ?? '')),
        ),
      rename_note: (commandArgs) =>
        renameNoteRequest({
          vault_path: commandArgs?.vaultPath ?? resolvedVaultPath,
          old_path: commandArgs?.oldPath,
          new_title: commandArgs?.newTitle,
          old_title: commandArgs?.oldTitle ?? null,
        }),
      rename_note_filename: (commandArgs) =>
        readJson('/api/vault/rename-filename', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            vault_path: commandArgs?.vaultPath ?? resolvedVaultPath,
            old_path: commandArgs?.oldPath,
            new_filename_stem: commandArgs?.newFilenameStem,
          }),
        }),
      search_vault: (commandArgs) => {
        const resolvedPath = String(commandArgs?.path ?? commandArgs?.vaultPath ?? resolvedVaultPath)
        const query = encodeURIComponent(String(commandArgs?.query ?? ''))
        const mode = encodeURIComponent(String(commandArgs?.mode ?? 'all'))
        return readJson(
          `/api/vault/search?vault_path=${encodeURIComponent(resolvedPath)}&query=${query}&mode=${mode}`,
        )
      },
      auto_rename_untitled: async (commandArgs) => {
        const notePath = String(commandArgs?.notePath ?? '')
        const contentData = await readJson(
          `/api/vault/content?path=${encodeURIComponent(notePath)}`,
        ) as { content: string }
        const match = contentData.content.match(/^#\s+(.+)$/m)
        if (!match) return null
        return renameNoteRequest({
          vault_path: commandArgs?.vaultPath ?? resolvedVaultPath,
          old_path: notePath,
          new_title: match[1].trim(),
        })
      },
    }

    const invoke = async (command: string, args?: Record<string, unknown>) => {
      const handler = commandHandlers[command] ?? window.__mockHandlers?.[command]
      if (!handler) throw new Error(`Unhandled invoke: ${command}`)
      return handler(args)
    }

    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {},
    })
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: { invoke },
    })
  }, vaultPath)

  await page.waitForFunction(() => Boolean(window.__TAURI_INTERNALS__))
}

export const openFixtureVaultTauri = openFixtureVaultDesktopHarness
