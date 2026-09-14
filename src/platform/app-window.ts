import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from './tauri'

/**
 * Close Fuwa's window. On macOS the app stays in the Dock (the Rust side
 * keeps it running after the last window closes) and a Dock reopen restores
 * the Session. Outside Tauri there is no window to close.
 */
export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) {
    console.info('[window] Nothing to close outside Tauri')
    return
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().close()
}

/**
 * Exit Fuwa. The renderer calls this as the last step of ⌘Q, once every
 * pending write has landed or the user chose Discard and quit; the
 * Rust side flushes the Session file on its way out. Outside Tauri the Folder
 * fixture records the call so the smoke specs can see the quit.
 */
export function exitApp(): Promise<void> {
  return isTauri() ? invoke<void>('quit_app') : mockInvoke<void>('quit_app')
}
