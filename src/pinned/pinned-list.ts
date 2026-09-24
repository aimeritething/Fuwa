import type { ListedFile } from '@/folder/explorer'
import { isWithinPrefix, replaceFolderPrefix } from '@/folder/folder-action-utils'
import { isPathInsideVaultRoot } from '@/lib/vault-path-containment'

/**
 * The Pinned lists (CONTEXT.md, Pinned): one ordered list of paths per
 * Folder, keyed by the Folder's path, kept in the Session and never in the
 * Folder. Everything here is a pure function of the lists, so the rules —
 * what may be pinned, how a rename carries a pin along, when a pin goes
 * away — are checked without React.
 */

/** Each Folder's pinned paths, in the order the user gave them. */
export type PinnedLists = Readonly<Record<string, readonly string[]>>

export const NO_PINS: readonly string[] = []

/** The Folder's list, or the empty one. */
export function pinnedIn(lists: PinnedLists, folder: string | null): readonly string[] {
  return (folder !== null && lists[folder]) || NO_PINS
}

/** The lists with `folder`'s replaced; an empty list leaves no key behind. */
export function withPinnedIn(lists: PinnedLists, folder: string, list: readonly string[]): PinnedLists {
  if (list === pinnedIn(lists, folder)) return lists
  const next = { ...lists }
  if (list.length === 0) delete next[folder]
  else next[folder] = list
  return next
}

/**
 * Whether a path may be pinned in `folder`: a Document or an Image file the
 * Folder lists. A sub-folder may not, nor a file outside the Folder.
 */
export function isPinnable(path: string, folder: string | null, files: readonly ListedFile[]): boolean {
  if (folder === null || path === folder || !isPathInsideVaultRoot(path, folder)) return false
  return files.some((file) => file.path === path && file.kind !== 'folder')
}

/** Pin: appended at the end; a path already pinned stays where it is. */
export function pinPath(list: readonly string[], path: string): readonly string[] {
  return list.includes(path) ? list : [...list, path]
}

export function unpinPath(list: readonly string[], path: string): readonly string[] {
  return list.includes(path) ? list.filter((pinned) => pinned !== path) : list
}

/**
 * The drag in the Pinned list: `path` moves to sit before `before`, or to the
 * end when `before` is null. Dropping a row on its own place changes nothing.
 */
export function movePinned(list: readonly string[], path: string, before: string | null): readonly string[] {
  if (!list.includes(path) || path === before) return list
  const rest = list.filter((pinned) => pinned !== path)
  const index = before === null ? rest.length : rest.indexOf(before)
  if (index === -1) return list
  const next = [...rest.slice(0, index), path, ...rest.slice(index)]
  return next.every((pinned, i) => pinned === list[i]) ? list : next
}

/**
 * A rename or move made in Plumo: a pinned file, and every pinned file under
 * a renamed folder, follows it to its new path and keeps its place. One that
 * lands outside the Folder is unpinned.
 */
export function retargetPinned(list: readonly string[], oldPath: string, newPath: string, folder: string): readonly string[] {
  if (!list.some((path) => isWithinPrefix({ path, prefix: oldPath }))) return list
  const next: string[] = []
  for (const path of list) {
    const moved = replaceFolderPrefix({ path, oldPrefix: oldPath, newPrefix: newPath })
    if (!isPathInsideVaultRoot(moved, folder) || next.includes(moved)) continue
    next.push(moved)
  }
  return next
}

/**
 * The Folder listing is the truth about what is still there: a pin whose file
 * the Folder no longer lists as a Document or an Image file (deleted, moved
 * away or renamed outside Plumo) is unpinned.
 */
export function prunePinned(list: readonly string[], files: readonly ListedFile[]): readonly string[] {
  if (list.length === 0) return list
  const listed = new Set(files.filter((file) => file.kind !== 'folder').map((file) => file.path))
  const next = list.filter((path) => listed.has(path))
  return next.length === list.length ? list : next
}

/** The Session's `pinned`, read defensively: string lists only, each path once. */
export function parsePinnedLists(value: unknown): PinnedLists {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const lists: Record<string, readonly string[]> = {}
  for (const [folder, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) continue
    const list = [...new Set(paths.filter((path): path is string => typeof path === 'string' && isPathInsideVaultRoot(path, folder) && path !== folder))]
    if (list.length > 0) lists[folder] = list
  }
  return lists
}
