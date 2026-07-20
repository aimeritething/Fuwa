import { isTauri } from '../mock-tauri'
import { trackQuickLauncherOpened } from '../lib/productAnalytics'

export const QUICK_LAUNCHER_WINDOW_LABEL = 'quick-launcher'
const QUICK_LAUNCHER_WINDOW_TITLE = 'Tolaria Quick Launcher'
const APP_ORIGIN_PROTOCOLS = new Set(['http:', 'https:'])

interface QuickLauncherWindowHandle {
  setFocus: () => Promise<void>
  show: () => Promise<void>
  unminimize: () => Promise<void>
}

export function buildQuickLauncherWindowUrl(): string {
  return '/?window=quick-launcher'
}

function runtimeQuickLauncherWindowUrl(): string {
  const route = buildQuickLauncherWindowUrl()
  if (!APP_ORIGIN_PROTOCOLS.has(window.location.protocol)) return route
  return new URL(route, window.location.origin).toString()
}

function quickLauncherWindowOptions() {
  return {
    url: runtimeQuickLauncherWindowUrl(),
    title: QUICK_LAUNCHER_WINDOW_TITLE,
    width: 540,
    height: 420,
    minWidth: 540,
    minHeight: 420,
    center: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    decorations: false,
    shadow: false,
    transparent: true,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    focus: true,
    visible: true,
  }
}

async function focusExistingLauncher(existing: QuickLauncherWindowHandle): Promise<void> {
  await existing.unminimize()
  await existing.show()
  await existing.setFocus()
}

export async function openQuickLauncherWindow(): Promise<void> {
  if (!isTauri()) return

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const existing = await WebviewWindow.getByLabel(QUICK_LAUNCHER_WINDOW_LABEL)
  if (existing) {
    await focusExistingLauncher(existing)
    trackQuickLauncherOpened()
    return
  }

  new WebviewWindow(QUICK_LAUNCHER_WINDOW_LABEL, quickLauncherWindowOptions())
  trackQuickLauncherOpened()
}

export async function hideQuickLauncherWindow(): Promise<void> {
  if (!isTauri()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().hide()
}
