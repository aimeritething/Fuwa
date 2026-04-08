import { expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const FIXTURE_VAULT = path.resolve('tests/fixtures/test-vault')

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ref: any = null
    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value
        ref.load_vault_list = () => ({
          vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
          active_vault: resolvedVaultPath,
          hidden_defaults: [],
        })
        ref.check_vault_exists = () => true
        ref.get_last_vault_path = () => resolvedVaultPath
        ref.get_default_vault_path = () => resolvedVaultPath
        ref.save_vault_list = () => null
      },
      get() {
        return ref
      },
    })
  }, vaultPath)

  await page.goto('/')
  await page.locator('[data-testid="note-list-container"]').waitFor({ timeout: 15_000 })
  await expect(page.getByText('Alpha Project', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
}
