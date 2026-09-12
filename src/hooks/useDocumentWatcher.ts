import { useCallback, useEffect, useMemo } from 'react'
import { isTauri } from '../mock-tauri'
import { documentRoot } from '../utils/explorer'
import { isMissingFileError } from '../utils/missingFile'
import { resolveExternalTabChanges } from '../utils/externalTabChanges'
import { isPathInsideVaultRoot } from '../utils/vaultPathContainment'
import { normalizeWatchPath, useVaultWatcher } from './useVaultWatcher'

interface Options {
  folder: string | null
  paths: string[]
  refresh: () => Promise<void>
  reload: (path: string, canReload: () => boolean) => Promise<void>
  isPending: (path: string) => boolean
  /** Every path the Folder lists, read after the refresh rather than at render. */
  listedPaths: () => string[]
  /** Rule 4: a file, and everything under a folder, follows its new path. */
  retargetTabs: (oldPath: string, newPath: string) => void
  /** Rules 3 and 5: cancel any pending Autosave, then close the Tabs at or under a path. */
  dropTabsUnder: (path: string) => void
}

/**
 * The Folder and the open Documents as the watcher sees them.
 * The listing is refreshed first, because whether a Tab's file still exists is
 * what decides between a reload, a retarget and a close; the rules themselves
 * live in `resolveExternalTabChanges`.
 *
 * A pending Autosave stops a reload from overwriting what is still being
 * typed, but never stops a close: a file deleted in Finder takes its Tab with
 * it, and cancelling that Tab's Autosave is what keeps Fuwa from writing the
 * file back.
 */
export function useDocumentWatcher({
  folder, paths, refresh, reload, isPending, listedPaths, retargetTabs, dropTabsUnder,
}: Options) {
  const rootsKey = JSON.stringify([...new Set([
    ...(folder ? [folder] : []), ...paths.map((path) => documentRoot(path, folder)),
  ])])
  const vaultPaths = useMemo<string[]>(() => JSON.parse(rootsKey), [rootsKey])
  const onVaultChanged = useCallback(async (changedPaths: string[]) => {
    const changed = changedPaths.map(normalizeWatchPath)
    const touchesFolder = folder !== null && (
      changed.length === 0
      || changed.some((path) => isPathInsideVaultRoot(path, normalizeWatchPath(folder)))
      || changed.some((path) => isPathInsideVaultRoot(normalizeWatchPath(folder), path))
    )
    if (touchesFolder) {
      await refresh().catch((error: unknown) => console.warn('Could not refresh the Folder:', error))
    }

    const changes = resolveExternalTabChanges({
      tabPaths: paths,
      changedPaths: changed,
      listedPaths: listedPaths(),
      folder,
    })
    const reloads: Promise<unknown>[] = []
    for (const change of changes) {
      if (change.kind === 'close') dropTabsUnder(change.path)
      else if (change.kind === 'retarget') retargetTabs(change.path, change.newPath)
      // A Document outside the Folder is not in the listing, so its read is
      // what reports the delete: a refused reload closes the Tab (rule 3).
      else if (!isPending(change.path)) {
        reloads.push(reload(change.path, () => !isPending(change.path)).catch((error: unknown) => {
          if (isMissingFileError(error)) dropTabsUnder(change.path)
          else console.warn('Could not refresh an external file change:', error)
        }))
      }
    }
    await Promise.all(reloads)
  }, [dropTabsUnder, folder, isPending, listedPaths, paths, refresh, reload, retargetTabs])
  useVaultWatcher({ vaultPaths, onVaultChanged })
  useEffect(() => {
    if (isTauri()) return
    const handle = (event: Event) => { void onVaultChanged((event as CustomEvent<string[]>).detail) }
    window.addEventListener('fuwa:external-change', handle)
    return () => window.removeEventListener('fuwa:external-change', handle)
  }, [onVaultChanged])
}
