import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

const MAIN_WINDOW_MIN_HEIGHT = 400

export type MainWindowPaneVisibility = {
  sidebarVisible: boolean
  noteListVisible: boolean
  inspectorCollapsed: boolean
}

export function getMainWindowMinWidth({
  sidebarVisible,
  noteListVisible,
  inspectorCollapsed,
}: MainWindowPaneVisibility): number {
  let minWidth = 800

  if (sidebarVisible) minWidth += 180
  if (noteListVisible) minWidth += 220
  if (!inspectorCollapsed) minWidth += 240

  return minWidth
}

type MainWindowSizeConstraintsOptions = MainWindowPaneVisibility & {
  enabled?: boolean
}

export async function applyMainWindowSizeConstraints(
  minWidth: number,
): Promise<void> {
  await invoke('update_current_window_min_size', {
    minWidth,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    growToFit: true,
  })
}

export function useMainWindowSizeConstraints({
  enabled = true,
  sidebarVisible,
  noteListVisible,
  inspectorCollapsed,
}: MainWindowSizeConstraintsOptions): void {
  const minWidth = getMainWindowMinWidth({
    sidebarVisible,
    noteListVisible,
    inspectorCollapsed,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    void (async () => {
      if (cancelled) return
      await applyMainWindowSizeConstraints(minWidth)
    })().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [enabled, minWidth])
}
