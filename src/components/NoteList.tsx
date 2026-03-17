import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus } from '../types'
import { NoteItem } from './NoteItem'
import { prefetchNoteContent } from '../hooks/useTabManagement'
import { BulkActionBar } from './BulkActionBar'
import { useMultiSelect } from '../hooks/useMultiSelect'
import { useNoteListKeyboard } from '../hooks/useNoteListKeyboard'
import { NoteListHeader } from './note-list/NoteListHeader'
import { EntityView, ListView } from './note-list/NoteListViews'
import { DeletedNotesBanner } from './note-list/TrashWarningBanner'
import { routeNoteClick, toggleSetMember, resolveHeaderTitle } from './note-list/noteListUtils'
import {
  useTypeEntryMap, useNoteListData, useNoteListSearch,
  useNoteListSort, useMultiSelectKeyboard, useModifiedFilesState,
} from './note-list/noteListHooks'

interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  modifiedFiles?: ModifiedFile[]
  modifiedFilesError?: string | null
  getNoteStatus?: (path: string) => NoteStatus
  sidebarCollapsed?: boolean
  onSelectNote: (entry: VaultEntry) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onCreateNote: () => void
  onBulkArchive?: (paths: string[]) => void
  onBulkTrash?: (paths: string[]) => void
  onBulkRestore?: (paths: string[]) => void
  onBulkDeletePermanently?: (paths: string[]) => void
  onEmptyTrash?: () => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
}

function NoteListInner({ entries, selection, selectedNote, modifiedFiles, modifiedFilesError, getNoteStatus, sidebarCollapsed, onSelectNote, onReplaceActiveTab, onCreateNote, onBulkArchive, onBulkTrash, onBulkRestore, onBulkDeletePermanently, onEmptyTrash, onUpdateTypeSort, updateEntry }: NoteListProps) {
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)
  const { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument } = useNoteListSort({ entries, selection, modifiedPathSet, modifiedSuffixes, onUpdateTypeSort, updateEntry })
  const { search, setSearch, query, searchVisible, toggleSearch } = useNoteListSearch()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const typeEntryMap = useTypeEntryMap(entries)
  const { isEntityView, isTrashView, searched, searchedGroups, expiredTrashCount } = useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes })
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const deletedCount = useMemo(
    () => isChangesView ? (modifiedFiles ?? []).filter((f) => f.status === 'deleted').length : 0,
    [isChangesView, modifiedFiles],
  )
  const entitySelection = isEntityView && selection.kind === 'entity' ? selection : null

  const noteListKeyboard = useNoteListKeyboard({ items: searched, selectedNotePath: selectedNote?.path ?? null, onOpen: onReplaceActiveTab, enabled: !isEntityView })
  const multiSelect = useMultiSelect(searched, selectedNote?.path ?? null)
  useEffect(() => { multiSelect.clear() }, [selection]) // eslint-disable-line react-hooks/exhaustive-deps -- clear on selection change only

  const handleClickNote = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    routeNoteClick(entry, e, { onReplace: onReplaceActiveTab, onSelect: onSelectNote, multiSelect })
  }, [onReplaceActiveTab, onSelectNote, multiSelect])

  const handleBulkArchive = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkArchive?.(paths) }, [multiSelect, onBulkArchive])
  const handleBulkTrash = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkTrash?.(paths) }, [multiSelect, onBulkTrash])
  const handleBulkRestore = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkRestore?.(paths) }, [multiSelect, onBulkRestore])
  const handleBulkDeletePermanently = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkDeletePermanently?.(paths) }, [multiSelect, onBulkDeletePermanently])
  const bulkArchiveOrRestore = isTrashView ? handleBulkRestore : handleBulkArchive
  const bulkTrashOrDelete = isTrashView ? handleBulkDeletePermanently : handleBulkTrash
  useMultiSelectKeyboard(multiSelect, isEntityView, bulkArchiveOrRestore, bulkTrashOrDelete)

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} isMultiSelected={multiSelect.selectedPaths.has(entry.path)} isHighlighted={entry.path === noteListKeyboard.highlightedPath} noteStatus={resolvedGetNoteStatus(entry.path)} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} onPrefetch={prefetchNoteContent} />
  ), [selectedNote?.path, handleClickNote, typeEntryMap, resolvedGetNoteStatus, multiSelect.selectedPaths, noteListKeyboard.highlightedPath])

  const toggleGroup = useCallback((label: string) => { setCollapsedGroups((prev) => toggleSetMember(prev, label)) }, [])
  const title = resolveHeaderTitle(selection, typeDocument)

  return (
    <div className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground" style={{ height: '100%' }}>
      <NoteListHeader title={title} typeDocument={typeDocument} isEntityView={isEntityView} isTrashView={isTrashView} trashCount={searched.length} listSort={listSort} listDirection={listDirection} customProperties={customProperties} sidebarCollapsed={sidebarCollapsed} searchVisible={searchVisible} search={search} onSortChange={handleSortChange} onCreateNote={onCreateNote} onOpenType={onReplaceActiveTab} onToggleSearch={toggleSearch} onSearchChange={setSearch} onEmptyTrash={onEmptyTrash} />
      <div className="flex flex-1 flex-col overflow-hidden outline-none" style={{ minHeight: 0 }} tabIndex={0} onKeyDown={noteListKeyboard.handleKeyDown} onFocus={noteListKeyboard.handleFocus} data-testid="note-list-container">
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {entitySelection ? (
            <EntityView entity={entitySelection.entry} groups={searchedGroups} query={query} collapsedGroups={collapsedGroups} sortPrefs={sortPrefs} onToggleGroup={toggleGroup} onSortChange={handleSortChange} renderItem={renderItem} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
          ) : (
            <ListView isTrashView={isTrashView} isChangesView={isChangesView} changesError={modifiedFilesError} expiredTrashCount={expiredTrashCount} deletedCount={deletedCount} searched={searched} query={query} renderItem={renderItem} virtuosoRef={noteListKeyboard.virtuosoRef} />
          )}
        </div>
        {isChangesView && deletedCount > 0 && <DeletedNotesBanner count={deletedCount} />}
      </div>
      {multiSelect.isMultiSelecting && (
        <BulkActionBar count={multiSelect.selectedPaths.size} isTrashView={isTrashView} onArchive={handleBulkArchive} onTrash={handleBulkTrash} onRestore={handleBulkRestore} onDeletePermanently={handleBulkDeletePermanently} onClear={multiSelect.clear} />
      )}
    </div>
  )
}

export const NoteList = memo(NoteListInner)
