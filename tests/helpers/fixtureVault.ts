import { expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const FIXTURE_VAULT = path.resolve('tests/fixtures/test-vault')
const FIXTURE_VAULT_READY_TIMEOUT = 30_000

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
  fs.rmSync(tempVaultDir, { recursive: true, force: true })
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

export async function openFixtureVaultTauri(
  page: Page,
  vaultPath: string,
): Promise<void> {
  await openFixtureVault(page, vaultPath)
  await page.evaluate((resolvedVaultPath: string) => {
    const jsonHeaders = { 'Content-Type': 'application/json' }
    const nativeFetch = window.fetch.bind(window)

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

    const invoke = async (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'trigger_menu_command': {
          const commandId = String(args?.id ?? '')
          const bridge = window.__laputaTest?.dispatchBrowserMenuCommand
          if (!bridge) throw new Error('Laputa test bridge is missing dispatchBrowserMenuCommand')
          bridge(commandId)
          return null
        }
        case 'load_vault_list':
          return {
            vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
            active_vault: resolvedVaultPath,
            hidden_defaults: [],
          }
        case 'check_vault_exists':
        case 'is_git_repo':
          return true
        case 'get_last_vault_path':
        case 'get_default_vault_path':
          return resolvedVaultPath
        case 'save_vault_list':
        case 'save_settings':
        case 'register_mcp_tools':
        case 'reinit_telemetry':
        case 'update_menu_state':
          return null
        case 'get_settings':
          return {
            github_token: null,
            github_username: null,
            auto_pull_interval_minutes: 5,
            telemetry_consent: false,
            crash_reporting_enabled: null,
            analytics_enabled: null,
            anonymous_id: null,
            release_channel: null,
          }
        case 'list_vault':
        case 'reload_vault': {
          const path = String(args?.path ?? resolvedVaultPath)
          return readJson(`/api/vault/list?path=${encodeURIComponent(path)}&reload=${command === 'reload_vault' ? '1' : '0'}`)
        }
        case 'list_vault_folders':
        case 'list_views':
        case 'get_modified_files':
        case 'detect_renames':
          return []
        case 'reload_vault_entry':
          return readJson(`/api/vault/entry?path=${encodeURIComponent(String(args?.path ?? ''))}`)
        case 'get_note_content': {
          const data = await readJson(`/api/vault/content?path=${encodeURIComponent(String(args?.path ?? ''))}`) as { content: string }
          return data.content
        }
        case 'get_all_content':
          return readJson(`/api/vault/all-content?path=${encodeURIComponent(String(args?.path ?? resolvedVaultPath))}`)
        case 'save_note_content':
          return readJson('/api/vault/save', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ path: args?.path, content: args?.content }),
          })
        case 'rename_note':
          return readJson('/api/vault/rename', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              vault_path: args?.vaultPath ?? resolvedVaultPath,
              old_path: args?.oldPath,
              new_title: args?.newTitle,
              old_title: args?.oldTitle ?? null,
            }),
          })
        case 'rename_note_filename':
          return readJson('/api/vault/rename-filename', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              vault_path: args?.vaultPath ?? resolvedVaultPath,
              old_path: args?.oldPath,
              new_filename_stem: args?.newFilenameStem,
            }),
          })
        case 'search_vault': {
          const path = String(args?.path ?? args?.vaultPath ?? resolvedVaultPath)
          const query = encodeURIComponent(String(args?.query ?? ''))
          const mode = encodeURIComponent(String(args?.mode ?? 'all'))
          return readJson(`/api/vault/search?vault_path=${encodeURIComponent(path)}&query=${query}&mode=${mode}`)
        }
        case 'auto_rename_untitled': {
          const notePath = String(args?.notePath ?? '')
          const contentData = await readJson(`/api/vault/content?path=${encodeURIComponent(notePath)}`) as { content: string }
          const match = contentData.content.match(/^#\s+(.+)$/m)
          if (!match) return null
          return readJson('/api/vault/rename', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              vault_path: args?.vaultPath ?? resolvedVaultPath,
              old_path: notePath,
              new_title: match[1].trim(),
            }),
          })
        }
        default: {
          const handler = window.__mockHandlers?.[command]
          if (!handler) throw new Error(`Unhandled invoke: ${command}`)
          return handler(args)
        }
      }
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
