import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import type { VaultEntry } from '../../types'
import type { SortOption, SortDirection } from '../../utils/noteListHelpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDragRegion } from '../../hooks/useDragRegion'
import { SortDropdown } from '../SortDropdown'
import { ListPropertiesPopover, type ListPropertiesPopoverProps } from './ListPropertiesPopover'

const NOTE_LIST_ACTION_BUTTON_CLASSNAME = 'h-7 w-7 text-muted-foreground'

export function NoteListHeader({ title, typeDocument, isEntityView, listSort, listDirection, customProperties, sidebarCollapsed, searchVisible, search, propertyPicker, onSortChange, onCreateNote, onOpenType, onToggleSearch, onSearchChange }: {
  title: string
  typeDocument: VaultEntry | null
  isEntityView: boolean
  listSort: SortOption
  listDirection: SortDirection
  customProperties: string[]
  sidebarCollapsed?: boolean
  searchVisible: boolean
  search: string
  propertyPicker?: ListPropertiesPopoverProps | null
  onSortChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
  onCreateNote: () => void
  onOpenType: (entry: VaultEntry) => void
  onToggleSearch: () => void
  onSearchChange: (value: string) => void
}) {
  const { onMouseDown: onDragMouseDown } = useDragRegion()
  return (
    <>
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4" onMouseDown={onDragMouseDown} style={{ cursor: 'default', paddingLeft: sidebarCollapsed ? 80 : undefined }}>
        <h3
          className="m-0 min-w-0 flex-1 truncate text-[14px] font-semibold"
          style={typeDocument ? { cursor: 'pointer' } : undefined}
          onClick={typeDocument ? () => onOpenType(typeDocument) : undefined}
          data-testid={typeDocument ? 'type-header-link' : undefined}
        >
          {title}
        </h3>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {!isEntityView && <SortDropdown groupLabel="__list__" current={listSort} direction={listDirection} customProperties={customProperties} onChange={onSortChange} />}
          <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} onClick={onToggleSearch} title="Search notes" aria-label="Search notes">
            <MagnifyingGlass size={16} />
          </Button>
          {propertyPicker && <ListPropertiesPopover {...propertyPicker} triggerClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME} />}
          <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} onClick={onCreateNote} title="Create new note" aria-label="Create new note">
            <Plus size={16} />
          </Button>
        </div>
      </div>
      {searchVisible && (
        <div className="border-b border-border px-3 py-2">
          <Input placeholder="Search notes..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="h-8 text-[13px]" autoFocus />
        </div>
      )}
    </>
  )
}
