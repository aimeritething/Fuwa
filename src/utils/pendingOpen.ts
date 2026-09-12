import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { TauriUnlisten } from './tauriEventCleanup'

/**
 * The command boundary for Finder, Open With and Dock opens. The
 * Rust side buffers every path Launch Services hands it and pokes the
 * renderer with an event; the buffer is the source of truth and the poke
 * only says "drain now" (ADR-0010). Outside Tauri the Folder fixture holds
 * the buffer and a window event stands in for the poke.
 */

/** The Rust side's poke, and the fixture's stand-in for it. */
export const OPEN_FILES_EVENT = 'fuwa://open-files'
export const MOCK_OPEN_FILES_EVENT = 'fuwa:open-files'

/** Drain the buffered paths; a second call answers empty. */
export function takePendingOpen(): Promise<string[]> {
  return isTauri() ? invoke<string[]>('take_pending_open') : mockInvoke<string[]>('take_pending_open')
}

/**
 * Hear every poke. Resolves once the listener is registered, so a caller
 * that drains after awaiting it cannot miss an open that lands in between.
 */
export async function listenForOpenRequests(onPoke: () => void): Promise<TauriUnlisten> {
  if (!isTauri()) {
    const handle = () => onPoke()
    window.addEventListener(MOCK_OPEN_FILES_EVENT, handle)
    return () => window.removeEventListener(MOCK_OPEN_FILES_EVENT, handle)
  }
  const { listen } = await import('@tauri-apps/api/event')
  return listen<string[]>(OPEN_FILES_EVENT, () => onPoke())
}
