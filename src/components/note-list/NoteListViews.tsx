import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { VaultEntry } from '../../types'
import type { SortOption, SortDirection, SortConfig, RelationshipGroup } from '../../utils/noteListHelpers'
import { PinnedCard } from './PinnedCard'
import { RelationshipGroupSection } from './RelationshipGroupSection'
import { TrashWarningBanner, EmptyMessage } from './TrashWarningBanner'

function ListViewHeader({ isTrashView, expiredTrashCount }: {
  isTrashView: boolean; expiredTrashCount: number
}) {
  return <TrashWarningBanner expiredCount={isTrashView ? expiredTrashCount : 0} />
}

function resolveEmptyText(isChangesView: boolean, changesError: string | null | undefined, isTrashView: boolean, isArchivedView: boolean, isInboxView: boolean, query: string): string {
  if (isChangesView && changesError) return `Failed to load changes: ${changesError}`
  if (isChangesView) return 'No pending changes'
  if (isTrashView) return 'Trash is empty'
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

export function ListView({ isTrashView, isArchivedView, isChangesView, isInboxView, changesError, expiredTrashCount, deletedCount = 0, searched, query, renderItem, virtuosoRef }: {
  isTrashView: boolean; isArchivedView?: boolean; isChangesView?: boolean; isInboxView?: boolean; changesError?: string | null; expiredTrashCount: number
  deletedCount?: number; searched: VaultEntry[]; query: string
  renderItem: (entry: VaultEntry) => React.ReactNode
  virtuosoRef?: React.RefObject<VirtuosoHandle | null>
}) {
  const emptyText = resolveEmptyText(!!isChangesView, changesError ?? null, isTrashView, !!isArchivedView, !!isInboxView, query)
  const hasHeader = isTrashView && expiredTrashCount > 0
  const hasDeletedOnly = !!isChangesView && deletedCount > 0 && searched.length === 0

  if (searched.length === 0 && !hasDeletedOnly) {
    return (
      <div className="h-full overflow-y-auto">
        {hasHeader && <ListViewHeader isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} />}
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
      components={{
        Header: hasHeader ? () => <ListViewHeader isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} /> : undefined,
      }}
      itemContent={(_index, entry) => renderItem(entry)}
    />
  )
}
