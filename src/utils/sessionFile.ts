import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { Session } from './sessionSchema'

/**
 * The Session file's command boundary. The Rust side owns `session.json`
 * (atomic write, ~500 ms debounce, a last flush on quit) and merges the
 * window frame in; the renderer only reads the file back at launch and hands
 * over its part of the state whenever it changes. Outside Tauri the Folder
 * fixture answers both commands.
 */

/** The raw file contents, or null when there is no Session to restore. */
export function readSessionFile(): Promise<unknown> {
  return isTauri() ? invoke<unknown>('read_session') : mockInvoke<unknown>('read_session')
}

export function updateSessionFile(session: Session): Promise<void> {
  const args = { session }
  return isTauri() ? invoke<void>('update_session', args) : mockInvoke<void>('update_session', args)
}
