import { useEffect, useSyncExternalStore } from 'react'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { isTauri } from '../mock-tauri'
import {
  DEFAULT_QUICK_LAUNCHER_SHORTCUT,
  replaceQuickLauncherShortcut,
} from '../lib/quickLauncherShortcut'
import { openQuickLauncherWindow } from '../utils/openQuickLauncherWindow'

export type QuickLauncherShortcutStatus =
  | { state: 'idle' | 'registering' }
  | { shortcut: string; state: 'active' }
  | { activeShortcut: string | null; message: string; state: 'error' }

let shortcutStatus: QuickLauncherShortcutStatus = { state: 'idle' }
let lastRequestedShortcut = DEFAULT_QUICK_LAUNCHER_SHORTCUT
const statusListeners = new Set<() => void>()

function publishShortcutStatus(status: QuickLauncherShortcutStatus): void {
  shortcutStatus = status
  statusListeners.forEach((listener) => {
    listener()
  })
}

function subscribeShortcutStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function useGlobalQuickLauncher(shortcut?: string | null, enabled = true): void {
  useEffect(() => {
    if (!enabled || !isTauri()) return
    const requestedShortcut = shortcut || DEFAULT_QUICK_LAUNCHER_SHORTCUT
    lastRequestedShortcut = requestedShortcut
    void registerRequestedShortcut(requestedShortcut)
  }, [enabled, shortcut])
}

async function registerRequestedShortcut(shortcut: string): Promise<void> {
  publishShortcutStatus({ state: 'registering' })
  const result = await replaceQuickLauncherShortcut({
    adapter: {
      register: (value, handler) => register(value, (event) => {
        if (event.state === 'Pressed') handler()
      }),
      unregister,
    },
    handler: () => { void openQuickLauncherWindow() },
    shortcut,
  })
  if (result.ok) {
    publishShortcutStatus({ shortcut: result.activeShortcut, state: 'active' })
  } else {
    publishShortcutStatus({
      activeShortcut: result.activeShortcut,
      message: result.error,
      state: 'error',
    })
  }
}

export function retryQuickLauncherShortcutRegistration(): Promise<void> {
  return registerRequestedShortcut(lastRequestedShortcut)
}

export function useQuickLauncherShortcutStatus(): QuickLauncherShortcutStatus {
  return useSyncExternalStore(subscribeShortcutStatus, () => shortcutStatus, () => shortcutStatus)
}

export function resetQuickLauncherShortcutStatusForTests(): void {
  shortcutStatus = { state: 'idle' }
  lastRequestedShortcut = DEFAULT_QUICK_LAUNCHER_SHORTCUT
  statusListeners.clear()
}
