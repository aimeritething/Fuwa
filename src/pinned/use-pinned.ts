import { useCallback, useMemo, useState } from 'react'
import type { ListedFile } from '@/folder/explorer'
import {
  isPinnable,
  movePinned,
  pinPath,
  pinnedIn,
  prunePinned,
  retargetPinned,
  unpinPath,
  withPinnedIn,
  type PinnedLists,
} from './pinned-list'

export interface PinnedState {
  /** Every Folder's list, as the Session holds it. */
  lists: PinnedLists
  /** The open Folder's pinned paths, in order. */
  paths: readonly string[]
  isPinned: (path: string) => boolean
  /** A Document or an Image file the open Folder lists. */
  canPin: (path: string) => boolean
  /** Pin/Unpin: a pinnable path joins the end of the list, a pinned one leaves it. */
  toggle: (path: string) => void
  /** The drag in the Pinned list: `path` goes before `before`, or last. */
  move: (path: string, before: string | null) => void
  /** A rename or move made in Plumo; the pins at or under `oldPath` follow it. */
  retarget: (oldPath: string, newPath: string) => void
  /** The Session's lists, put back at launch. */
  restore: (lists: PinnedLists) => void
}

/**
 * The Pinned lists and the rules over them. Only the open Folder's list is
 * shown and changed; the others ride along untouched until their Folder is
 * opened again. Whenever the Folder's listing changes, the pins it no longer
 * lists go (a file deleted or moved away in Finder). That runs on the listing
 * alone: a rename in Plumo retargets the pin before the listing catches up,
 * and the next listing holds the new path.
 */
export function usePinned(folder: string | null, files: readonly ListedFile[]): PinnedState {
  const [held, setHeld] = useState<{ lists: PinnedLists; prunedAgainst: readonly ListedFile[] | null }>({ lists: {}, prunedAgainst: null })
  const { lists } = held

  // `files` is the listing of `folder` (both change in one update), so this
  // never prunes one Folder's pins against another's listing. A restore
  // clears `prunedAgainst`, so restored pins are checked too, whichever of
  // the restore and the Folder's listing lands first.
  if (folder !== null && held.prunedAgainst !== files) {
    setHeld({ lists: withPinnedIn(lists, folder, prunePinned(pinnedIn(lists, folder), files)), prunedAgainst: files })
  }

  const update = useCallback((change: (list: readonly string[], folder: string) => readonly string[]) => {
    if (folder === null) return
    setHeld((prev) => {
      const next = withPinnedIn(prev.lists, folder, change(pinnedIn(prev.lists, folder), folder))
      return next === prev.lists ? prev : { ...prev, lists: next }
    })
  }, [folder])

  const paths = pinnedIn(lists, folder)
  const isPinned = useCallback((path: string) => paths.includes(path), [paths])
  const canPin = useCallback((path: string) => isPinnable(path, folder, files), [files, folder])

  const toggle = useCallback((path: string) => {
    if (paths.includes(path)) update((list) => unpinPath(list, path))
    else if (isPinnable(path, folder, files)) update((list) => pinPath(list, path))
  }, [files, folder, paths, update])

  const move = useCallback((path: string, before: string | null) => {
    update((list) => movePinned(list, path, before))
  }, [update])

  const retarget = useCallback((oldPath: string, newPath: string) => {
    update((list, current) => retargetPinned(list, oldPath, newPath, current))
  }, [update])

  const restore = useCallback((restored: PinnedLists) => {
    setHeld({ lists: restored, prunedAgainst: null })
  }, [])

  return useMemo(() => ({ lists, paths, isPinned, canPin, toggle, move, retarget, restore }), [
    canPin, isPinned, lists, move, paths, restore, retarget, toggle,
  ])
}
