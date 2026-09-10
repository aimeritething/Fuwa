import { isTauri } from '../mock-tauri'

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
