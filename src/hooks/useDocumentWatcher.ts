import { useCallback, useEffect, useMemo } from 'react'
import { isTauri } from '../mock-tauri'
import { documentRoot } from '../utils/explorer'
import { isPathInsideVaultRoot } from '../utils/vaultPathContainment'
import { normalizeWatchPath, useVaultWatcher } from './useVaultWatcher'

interface Options {
  folder: string | null
  paths: string[]
  refresh: () => Promise<void>
  reload: (path: string, canReload: () => boolean) => Promise<void>
  isPending: (path: string) => boolean
}

export function useDocumentWatcher({ folder, paths, refresh, reload, isPending }: Options) {
  const rootsKey = JSON.stringify([...new Set([
    ...(folder ? [folder] : []), ...paths.map((path) => documentRoot(path, folder)),
  ])])
  const vaultPaths = useMemo<string[]>(() => JSON.parse(rootsKey), [rootsKey])
  const onVaultChanged = useCallback(async (changedPaths: string[]) => {
    const changed = changedPaths.map(normalizeWatchPath)
    const includesPath = (path: string) => changed.length === 0 || changed.some((parent) =>
      isPathInsideVaultRoot(normalizeWatchPath(path), parent))
    const work: Promise<unknown>[] = []
    if (folder && (includesPath(folder) || changed.some((path) => isPathInsideVaultRoot(path, normalizeWatchPath(folder))))) {
      work.push(refresh())
    }
    for (const path of paths) {
      if (includesPath(path) && !isPending(path)) work.push(reload(path, () => !isPending(path)))
    }
    const results = await Promise.allSettled(work)
    for (const result of results) {
      if (result.status === 'rejected') console.warn('Could not refresh an external file change:', result.reason)
    }
  }, [folder, isPending, paths, refresh, reload])
  useVaultWatcher({ vaultPaths, onVaultChanged })
  useEffect(() => {
    if (isTauri()) return
    const handle = (event: Event) => { void onVaultChanged((event as CustomEvent<string[]>).detail) }
    window.addEventListener('fuwa:external-change', handle)
    return () => window.removeEventListener('fuwa:external-change', handle)
  }, [onVaultChanged])
}
