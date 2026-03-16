import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus } from '../../types'
import type { RelationshipGroup } from '../../utils/noteListHelpers'

export function resolveHeaderTitle(selection: SidebarSelection, typeDocument: VaultEntry | null): string {
  if (selection.kind === 'entity') return selection.entry.title
  if (typeDocument) return typeDocument.title
  if (selection.kind === 'filter' && selection.filter === 'archived') return 'Archive'
  if (selection.kind === 'filter' && selection.filter === 'trash') return 'Trash'
  if (selection.kind === 'filter' && selection.filter === 'changes') return 'Changes'
  return 'Notes'
}

export function filterByQuery<T extends { title: string }>(items: T[], query: string): T[] {
  return query ? items.filter((e) => e.title.toLowerCase().includes(query)) : items
}

export function filterGroupsByQuery(groups: RelationshipGroup[], query: string): RelationshipGroup[] {
  if (!query) return groups
  return groups.map((g) => ({ ...g, entries: filterByQuery(g.entries, query) })).filter((g) => g.entries.length > 0)
}

export function countExpiredTrash(entries: VaultEntry[]): number {
  const now = Date.now() / 1000
  return entries.filter((e) => e.trashedAt && (now - e.trashedAt) >= 86400 * 30).length
}

export interface ClickActions {
  onReplace: (entry: VaultEntry) => void
  onSelect: (entry: VaultEntry) => void
  multiSelect: { selectRange: (path: string) => void; clear: () => void; setAnchor: (path: string) => void }
}

export function routeNoteClick(entry: VaultEntry, e: React.MouseEvent, actions: ClickActions) {
  if (e.shiftKey) { actions.multiSelect.selectRange(entry.path) }
  else if (e.metaKey || e.ctrlKey) { actions.multiSelect.clear(); actions.onSelect(entry) }
  else { actions.multiSelect.clear(); actions.multiSelect.setAnchor(entry.path); actions.onReplace(entry) }
}

export function createNoteStatusResolver(
  getNoteStatus: ((path: string) => NoteStatus) | undefined,
  modifiedFiles: ModifiedFile[] | undefined,
  modifiedPathSet: Set<string>,
): (path: string) => NoteStatus {
  if (getNoteStatus) return getNoteStatus
  if (modifiedFiles && modifiedFiles.length > 0) {
    return (path: string) => modifiedPathSet.has(path) ? 'modified' : 'clean'
  }
  return () => 'clean'
}

export function toggleSetMember<T>(set: Set<T>, member: T): Set<T> {
  const next = new Set(set)
  if (next.has(member)) next.delete(member)
  else next.add(member)
  return next
}

export function isModifiedEntry(path: string, pathSet: Set<string>, suffixes: string[]): boolean {
  if (pathSet.has(path)) return true
  return suffixes.some((suffix) => path.endsWith(suffix))
}
