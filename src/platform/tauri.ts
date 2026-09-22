/**
 * Browser fallback for Tauri commands. Outside Tauri (`pnpm dev` in a plain
 * browser, the smoke specs) every `invoke` is answered by the in-memory Folder
 * fixture in `./vault-fixture`. The exports keep the kernel's names so the kept
 * call sites and their `vi.mock('./tauri')` calls resolve.
 */

import { createMockVault, type MockVault } from './mock/vault-fixture'

export type { MockVault, MockVaultCall, MockVaultFile, MockVaultImage, MockVaultListing } from './mock/vault-fixture'
export { createMockVault, DEFAULT_MOCK_VAULT_FILES, MOCK_VAULT_PATH } from './mock/vault-fixture'

export function isTauri(): boolean {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { isTauri?: unknown }).isTauri === 'boolean') {
    return Boolean((globalThis as { isTauri?: unknown }).isTauri)
  }

  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

let mockVault: MockVault | null = null

export function getMockVault(): MockVault {
  mockVault ??= createMockVault()
  return mockVault
}

/** Expose the fixture on `window` for the smoke specs. Dev-only, never in Tauri. */
export function installMockVault(): MockVault {
  const vault = getMockVault()
  if (typeof window !== 'undefined') window.__plumoMockVault = vault
  return vault
}

export function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return getMockVault().invoke<T>(cmd, args)
}

/** The browser's stand-in for the asset protocol: what an Image file's Tab shows outside Tauri. */
export function mockAssetUrl(path: string): string | null {
  return getMockVault().assetUrl(path)
}

/**
 * The kernel's mock-store writer. The save hook calls it after a mock save to
 * keep the store in step; it writes directly so the call log only records
 * what the app actually invoked.
 */
export function updateMockContent(path: string, content: string): void {
  try {
    getMockVault().writeNote(path, content)
  } catch (error) {
    console.warn('[platform/tauri] Ignored a write outside the mock Folder:', error)
  }
}
