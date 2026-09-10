/**
 * Browser fallback for Tauri commands. Fuwa has no mock vault yet, so
 * `mockInvoke` always rejects; the module exists so the kept call sites and the
 * carried `vi.mock('../mock-tauri')` calls resolve.
 */

export function isTauri(): boolean {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { isTauri?: unknown }).isTauri === 'boolean') {
    return Boolean((globalThis as { isTauri?: unknown }).isTauri)
  }

  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

export function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  void args
  return Promise.reject(new Error(`No mock handler for command: ${cmd}`))
}

export function addMockEntry(entry: unknown, content: string): void {
  void entry
  void content
}

export function updateMockContent(path: string, content: string): void {
  void path
  void content
}

export function trackMockChange(path: string): void {
  void path
}
