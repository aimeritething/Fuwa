import { useMemo } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { VaultEntry } from '../../types'
import {
  type SortOption, type SortDirection, type SortConfig, type RelationshipGroup,
  getSortComparator, extractSortableProperties,
} from '../../utils/noteListHelpers'
import { SortDropdown } from '../SortDropdown'

export function RelationshipGroupSection({ group, isCollapsed, sortPrefs, onToggle, handleSortChange, renderItem }: {
  group: RelationshipGroup
  isCollapsed: boolean
  sortPrefs: Record<string, SortConfig>
  onToggle: () => void
  handleSortChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
  renderItem: (entry: VaultEntry) => React.ReactNode
}) {
  const groupConfig = sortPrefs[group.label] ?? { option: 'modified' as SortOption, direction: 'desc' as SortDirection }
  const sortedEntries = [...group.entries].sort(getSortComparator(groupConfig.option, groupConfig.direction))
  const customProperties = useMemo(() => extractSortableProperties(group.entries), [group.entries])
  return (
    <div>
      <div className="flex w-full items-center justify-between bg-muted" style={{ height: 32, padding: '0 16px' }}>
        <button className="flex flex-1 items-center gap-1.5 border-none bg-transparent cursor-pointer p-0" onClick={onToggle}>
          <span className="font-mono-label text-muted-foreground">{group.label}</span>
          <span className="font-mono-label text-muted-foreground" style={{ fontWeight: 400 }}>{group.entries.length}</span>
        </button>
        <span className="flex items-center gap-1.5">
          <SortDropdown groupLabel={group.label} current={groupConfig.option} direction={groupConfig.direction} customProperties={customProperties} onChange={handleSortChange} />
          <button className="flex items-center border-none bg-transparent cursor-pointer p-0 text-muted-foreground" onClick={onToggle}>
            {isCollapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
          </button>
        </span>
      </div>
      {!isCollapsed && sortedEntries.map((entry) => renderItem(entry))}
    </div>
  )
}
