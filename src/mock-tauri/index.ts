/**
 * Browser fallback for Tauri commands. Outside Tauri (`pnpm dev` in a plain
 * browser, the smoke specs) every `invoke` is answered by the in-memory Folder
 * fixture in `./vaultFixture`. The exports keep Tolaria's names so the kept
 * call sites and the carried `vi.mock('../mock-tauri')` calls resolve.
 */

import { createMockVault, type MockVault } from './vaultFixture'

export type { MockVault, MockVaultCall, MockVaultFile, MockVaultListing } from './vaultFixture'
export { createMockVault, DEFAULT_MOCK_VAULT_FILES, MOCK_VAULT_PATH } from './vaultFixture'

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
  if (typeof window !== 'undefined') window.__fuwaMockVault = vault
  return vault
}

export function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return getMockVault().invoke<T>(cmd, args)
}

/**
 * Tolaria's mock-store writers. The kept hooks call these after a mock save to
 * keep the store in step; they write directly so the call log only records
 * what the app actually invoked.
 */
export function addMockEntry(entry: { path: string }, content: string): void {
  updateMockContent(entry.path, content)
}

export function updateMockContent(path: string, content: string): void {
  try {
    getMockVault().writeNote(path, content)
  } catch (error) {
    console.warn('[mock-tauri] Ignored a write outside the mock Folder:', error)
  }
}

export function trackMockChange(path: string): void {
  void path
}
