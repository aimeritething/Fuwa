import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { VaultEntry } from '../../types'
import type { SortOption, SortDirection, SortConfig, RelationshipGroup } from '../../utils/noteListHelpers'
import { PinnedCard } from './PinnedCard'
import { RelationshipGroupSection } from './RelationshipGroupSection'
import { EmptyMessage } from './TrashWarningBanner'

function resolveEmptyText(isChangesView: boolean, changesError: string | null | undefined, isArchivedView: boolean, isInboxView: boolean, query: string): string {
  if (isChangesView && changesError) return `Failed to load changes: ${changesError}`
  if (isChangesView) return 'No pending changes'
  if (isArchivedView) return 'No archived notes'
  if (isInboxView) return query ? 'No matching notes' : 'All notes are organized'
  return query ? 'No matching notes' : 'No notes found'
}

export function EntityView({ entity, groups, query, collapsedGroups, sortPrefs, onToggleGroup, onSortChange, renderItem, typeEntryMap, onClickNote }: {
  entity: VaultEntry; groups: RelationshipGroup[]; query: string
  collapsedGroups: Set<string>; sortPrefs: Record<string, SortConfig>
  onToggleGroup: (label: string) => void; onSortChange: (label: string, opt: SortOption, dir: SortDirection) => void
  renderItem: (entry: VaultEntry) => React.ReactNode
  typeEntryMap: Record<string, VaultEntry>; onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
}) {
  return (
    <div className="h-full overflow-y-auto">
      <PinnedCard entry={entity} typeEntryMap={typeEntryMap} onClickNote={onClickNote} showDate />
      {groups.length === 0
        ? <EmptyMessage text={query ? 'No matching items' : 'No related items'} />
        : groups.map((group) => (
          <RelationshipGroupSection key={group.label} group={group} isCollapsed={collapsedGroups.has(group.label)} sortPrefs={sortPrefs} onToggle={() => onToggleGroup(group.label)} handleSortChange={onSortChange} renderItem={renderItem} />
        ))
      }
    </div>
  )
}

export function ListView({ isArchivedView, isChangesView, isInboxView, changesError, deletedCount = 0, searched, query, renderItem, virtuosoRef }: {
  isArchivedView?: boolean; isChangesView?: boolean; isInboxView?: boolean; changesError?: string | null
  deletedCount?: number; searched: VaultEntry[]; query: string
  renderItem: (entry: VaultEntry) => React.ReactNode
  virtuosoRef?: React.RefObject<VirtuosoHandle | null>
}) {
  const emptyText = resolveEmptyText(!!isChangesView, changesError ?? null, !!isArchivedView, !!isInboxView, query)
  const hasDeletedOnly = !!isChangesView && deletedCount > 0 && searched.length === 0

  if (searched.length === 0 && !hasDeletedOnly) {
    return (
      <div className="h-full overflow-y-auto">
        <EmptyMessage text={emptyText} />
      </div>
    )
  }

  if (hasDeletedOnly) {
    return <div className="h-full" />
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height: '100%' }}
      data={searched}
      overscan={200}
      itemContent={(_index, entry) => renderItem(entry)}
    />
  )
}
