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
