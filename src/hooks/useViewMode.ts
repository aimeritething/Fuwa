import { useState, useCallback, useEffect } from 'react'
import { getVaultConfig, updateVaultConfigField, subscribeVaultConfig } from '../utils/vaultConfigStore'

export type ViewMode = 'editor-only' | 'editor-list' | 'all'

function isViewMode(v: string | null | undefined): v is ViewMode {
  return v === 'editor-only' || v === 'editor-list' || v === 'all'
}

function loadViewMode(): ViewMode {
  const stored = getVaultConfig().view_mode
  if (isViewMode(stored)) return stored
  // Fallback to localStorage during initial load (before vault config is ready)
  try {
    const ls = localStorage.getItem('laputa-view-mode')
    if (isViewMode(ls)) return ls
  } catch { /* ignore */ }
  return 'all'
}

export function useViewMode(initialOverride?: ViewMode) {
  const [viewMode, setViewModeState] = useState<ViewMode>(initialOverride ?? loadViewMode)

  // Re-sync when vault config becomes available
  useEffect(() => {
    return subscribeVaultConfig(() => {
      const stored = getVaultConfig().view_mode
      if (isViewMode(stored)) setViewModeState(stored)
    })
  }, [])

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    updateVaultConfigField('view_mode', mode)
  }, [])

  const sidebarVisible = viewMode === 'all'
  const noteListVisible = viewMode === 'all' || viewMode === 'editor-list'

  return { viewMode, setViewMode, sidebarVisible, noteListVisible }
}
