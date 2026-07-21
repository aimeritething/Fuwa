import { isTauri } from '../mock-tauri'
import { trackQuickLauncherOpened } from '../lib/productAnalytics'

export async function openQuickLauncherWindow(): Promise<void> {
  if (!isTauri()) return

  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('show_quick_launcher')
  trackQuickLauncherOpened()
}

export async function hideQuickLauncherWindow(): Promise<void> {
  if (!isTauri()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().hide()
}
