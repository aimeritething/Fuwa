import { isWithinPrefix, replaceFolderPrefix } from './folderActionUtils'
import { notePathFilename } from '@/lib/notePathIdentity'
import { isPathInsideVaultRoot } from '@/lib/vaultPathContainment'

/**
 * What an external change does to the open Tabs. The watcher reports changed
 * paths and nothing else — no "renamed from", no "deleted" — so a Tab whose
 * file has gone is resolved in two steps:
 *
 * 1. The path-prefix match of rule 5. A renamed folder reaches the watcher as
 *    the folder's own two paths, so a Tab under the old one is looked for at
 *    the same place under each other changed path. This is what tells two open
 *    Documents of the same name apart when their folder is renamed.
 * 2. The kernel's same-name heuristic, rule 4. If exactly one changed path now
 *    holds a file of that name, the Tab follows it; otherwise the Tab closes
 *    and the new name shows up in the Explorer as a fresh file.
 *
 * Existence comes from the Folder listing rather than a read (ADR-0008), which
 * is why a Document outside the Folder is always reloaded here: the listing
 * never holds it, and the read that fails is what closes its Tab (rule 3).
 */

export type ExternalTabChange =
  | { path: string; kind: 'reload' }
  | { path: string; kind: 'retarget'; newPath: string }
  | { path: string; kind: 'close' }

export interface ExternalTabChangeInput {
  /** The open Tabs, in Tab order. */
  tabPaths: readonly string[]
  /** The paths the watcher reported, already normalized. */
  changedPaths: readonly string[]
  /** Every path the Folder still lists, as of the refresh this change triggered. */
  listedPaths: readonly string[]
  folder: string | null
}

/** A changed path touches a Tab when it is the Tab's path or a folder above it. */
function touches(tabPath: string, changedPaths: readonly string[]): boolean {
  // An event with no paths is the watcher asking for a full refresh.
  if (changedPaths.length === 0) return true
  return changedPaths.some((changed) => isWithinPrefix({ path: tabPath, prefix: changed }))
}

/**
 * Rule 5: a folder above the Tab has gone, so the Tab is looked for at the same
 * place under each changed path that is still there. The vanished prefix must
 * be a folder above the Tab and not the Tab's own path — a file renamed in
 * place is rule 4's to answer, and rule 4 closes it.
 */
function prefixCandidates(
  tabPath: string,
  changedPaths: readonly string[],
  listed: ReadonlySet<string>,
): string[] {
  const candidates = new Set<string>()
  for (const oldPrefix of changedPaths) {
    const isFolderAbove = oldPrefix !== tabPath && isWithinPrefix({ path: tabPath, prefix: oldPrefix })
    if (!isFolderAbove || listed.has(oldPrefix)) continue
    for (const newPrefix of changedPaths) {
      if (newPrefix === oldPrefix) continue
      const moved = replaceFolderPrefix({ path: tabPath, oldPrefix, newPrefix })
      if (listed.has(moved)) candidates.add(moved)
    }
  }
  return [...candidates]
}

/**
 * Rule 4: the listed files at or under a changed path that still carry the
 * Tab's file name. A directory changed path expands to its listed contents, so
 * a file that moved with its folder is found by name when the prefix could not
 * place it.
 */
function sameNameCandidates(
  tabPath: string,
  changedPaths: readonly string[],
  listedPaths: readonly string[],
): string[] {
  const filename = notePathFilename(tabPath)
  return [...new Set(listedPaths.filter((listed) => (
    listed !== tabPath
    && notePathFilename(listed) === filename
    && changedPaths.some((changed) => isWithinPrefix({ path: listed, prefix: changed }))
  )))]
}

function resolveMissingTab(
  path: string,
  changedPaths: readonly string[],
  listedPaths: readonly string[],
  listed: ReadonlySet<string>,
): ExternalTabChange {
  const byPrefix = prefixCandidates(path, changedPaths, listed)
  const candidates = byPrefix.length === 1 ? byPrefix : sameNameCandidates(path, changedPaths, listedPaths)
  return candidates.length === 1
    ? { path, kind: 'retarget', newPath: candidates[0] }
    : { path, kind: 'close' }
}

export function resolveExternalTabChanges({
  tabPaths,
  changedPaths,
  listedPaths,
  folder,
}: ExternalTabChangeInput): ExternalTabChange[] {
  const listed = new Set(listedPaths)
  const changes: ExternalTabChange[] = []

  for (const path of tabPaths) {
    const insideFolder = folder !== null && isPathInsideVaultRoot(path, folder)
    // A Tab inside the Folder that the listing no longer holds is gone,
    // whichever paths the watcher happened to name: it takes only the new
    // path of a rename to leave the old one unmentioned.
    if (insideFolder && !listed.has(path)) {
      changes.push(resolveMissingTab(path, changedPaths, listedPaths, listed))
      continue
    }
    if (touches(path, changedPaths)) changes.push({ path, kind: 'reload' })
  }

  return changes
}
