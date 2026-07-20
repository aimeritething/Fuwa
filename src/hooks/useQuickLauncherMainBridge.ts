import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '../mock-tauri'
import {
  QUICK_LAUNCHER_OPEN_NOTE_EVENT,
  quickLauncherOpenNoteUrl,
} from '../lib/quickLauncherEvents'

export function useQuickLauncherMainBridge(openDeepLink: (url: string) => void): void {
  useEffect(() => {
    if (!isTauri()) return
    let disposed = false
    let removeListener: (() => void) | null = null
    void listen(QUICK_LAUNCHER_OPEN_NOTE_EVENT, (event) => {
      const url = quickLauncherOpenNoteUrl(event.payload)
      if (!url) return
      const mainWindow = getCurrentWindow()
      void mainWindow.unminimize().catch(() => undefined)
        .then(() => mainWindow.show().catch(() => undefined))
        .then(() => mainWindow.setFocus().catch(() => undefined))
        .then(() => openDeepLink(url))
    }).then((unlisten) => {
      if (disposed) unlisten()
      else removeListener = unlisten
    })

    return () => {
      disposed = true
      removeListener?.()
    }
  }, [openDeepLink])
}
