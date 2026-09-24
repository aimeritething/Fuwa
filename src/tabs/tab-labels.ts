import { notePathFilename } from '@/lib/note-path-identity'
import { noteRootForPath } from '@/folder/note-entry'

/**
 * What tells two open Tabs with the same file name apart (CONTEXT.md, Tab):
 * each also shows its parent folder's name, dimmed after its own. A Tab whose
 * name no other open Tab shares shows nothing more. Keyed by path; a Tab
 * missing from the map needs no hint.
 */
export function tabParentHints(paths: readonly string[]): ReadonlyMap<string, string> {
  const byName = new Map<string, string[]>()
  for (const path of paths) {
    const name = notePathFilename(path)
    byName.set(name, [...(byName.get(name) ?? []), path])
  }
  const hints = new Map<string, string>()
  for (const group of byName.values()) {
    if (group.length < 2) continue
    for (const path of group) hints.set(path, notePathFilename(noteRootForPath(path)))
  }
  return hints
}
