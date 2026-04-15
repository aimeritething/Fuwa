import { useMemo, useCallback } from 'react'
import type {
  VaultEntry,
  SidebarSelection,
  ModifiedFile,
  NoteStatus,
  InboxPeriod,
  ViewFile,
} from '../../types'
import type { NoteListFilter } from '../../utils/noteListHelpers'
import { countByFilter, countAllByFilter } from '../../utils/noteListHelpers'
import { NoteItem } from '../NoteItem'
import type { MultiSelectState } from '../../hooks/useMultiSelect'
import { resolveHeaderTitle, type DeletedNoteEntry } from './noteListUtils'
import {
  useChangeStatusResolver,
  useListPropertyPicker,
  useModifiedFilesState,
  useNoteListData,
  useNoteListInteractions,
  useNoteListSearch,
  useNoteListSort,
  useTypeEntryMap,
  useVisibleNotesSync,
} from './noteListHooks'
import { useChangesContextMenu } from './NoteListChangesMenu'

function useViewFlags(selection: SidebarSelection) {
  const isSectionGroup = selection.kind === 'sectionGroup'
  const isFolderView = selection.kind === 'folder'
  const isInboxView = selection.kind === 'filter' && selection.filter === 'inbox'
  const isAllNotesView = selection.kind === 'filter' && selection.filter === 'all'
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const showFilterPills = isSectionGroup || isFolderView
  return { isSectionGroup, isFolderView, isInboxView, isAllNotesView, isChangesView, showFilterPills }
}

function useBulkActions(
  multiSelect: MultiSelectState,
  onBulkArchive: NoteListProps['onBulkArchive'],
  onBulkDeletePermanently: NoteListProps['onBulkDeletePermanently'],
  isArchivedView: boolean,
) {
  const handleBulkArchive = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkArchive?.(paths)
  }, [multiSelect, onBulkArchive])

  const handleBulkDeletePermanently = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkDeletePermanently?.(paths)
  }, [multiSelect, onBulkDeletePermanently])

  const handleBulkUnarchive = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkArchive?.(paths)
  }, [multiSelect, onBulkArchive])

  const bulkArchiveOrUnarchive = isArchivedView ? handleBulkUnarchive : handleBulkArchive

  return {
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
    bulkArchiveOrUnarchive,
  }
}

export interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  noteListFilter: NoteListFilter
  onNoteListFilterChange: (filter: NoteListFilter) => void
  inboxPeriod?: InboxPeriod
  onInboxPeriodChange?: (period: InboxPeriod) => void
  modifiedFiles?: ModifiedFile[]
  modifiedFilesError?: string | null
  getNoteStatus?: (path: string) => NoteStatus
  sidebarCollapsed?: boolean
  onSelectNote: (entry: VaultEntry) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onCreateNote: (type?: string) => void
  onBulkArchive?: (paths: string[]) => void
  onBulkDeletePermanently?: (paths: string[]) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onDiscardFile?: (relativePath: string) => Promise<void>
  onAutoTriggerDiff?: () => void
  onOpenDeletedNote?: (entry: DeletedNoteEntry) => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: (value: string[] | null) => void
  views?: ViewFile[]
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
}

export function useNoteListModel({
  entries,
  selection,
  selectedNote,
  noteListFilter,
  onNoteListFilterChange,
  inboxPeriod = 'all',
  modifiedFiles,
  modifiedFilesError,
  getNoteStatus,
  sidebarCollapsed,
  onSelectNote,
  onReplaceActiveTab,
  onCreateNote,
  onBulkArchive,
  onBulkDeletePermanently,
  onUpdateTypeSort,
  updateEntry,
  onOpenInNewWindow,
  onDiscardFile,
  onAutoTriggerDiff,
  onOpenDeletedNote,
  inboxNoteListProperties,
  onUpdateInboxNoteListProperties,
  views,
  visibleNotesRef,
}: NoteListProps) {
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)
  const { isSectionGroup, isFolderView, isInboxView, isAllNotesView, isChangesView, showFilterPills } = useViewFlags(selection)
  const subFilter = showFilterPills ? noteListFilter : undefined

  const filterCounts = useMemo(
    () => isSectionGroup && selection.kind === 'sectionGroup'
      ? countByFilter(entries, selection.type)
      : (isAllNotesView || isFolderView)
          ? countAllByFilter(entries)
          : { open: 0, archived: 0 },
    [entries, isSectionGroup, isAllNotesView, isFolderView, selection],
  )

  const { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument } = useNoteListSort({
    entries,
    selection,
    modifiedPathSet,
    modifiedSuffixes,
    subFilter,
    inboxPeriod: isInboxView ? inboxPeriod : undefined,
    onUpdateTypeSort,
    updateEntry,
  })
  const { search, setSearch, query, searchVisible, toggleSearch } = useNoteListSearch()
  const typeEntryMap = useTypeEntryMap(entries)
  const { inboxDisplayOverride, propertyPicker } = useListPropertyPicker({
    entries,
    selection,
    inboxPeriod,
    typeDocument,
    typeEntryMap,
    inboxNoteListProperties,
    onUpdateInboxNoteListProperties,
    onUpdateTypeSort,
  })
  const { isEntityView, isArchivedView, searched, searchedGroups } = useNoteListData({
    entries,
    selection,
    query,
    listSort,
    listDirection,
    modifiedPathSet,
    modifiedSuffixes,
    modifiedFiles,
    subFilter,
    inboxPeriod: isInboxView ? inboxPeriod : undefined,
    views,
  })
  useVisibleNotesSync({ visibleNotesRef, isEntityView, searched, searchedGroups })

  const changesContextMenu = useChangesContextMenu({ isChangesView, onDiscardFile, modifiedFiles })
  const {
    collapsedGroups,
    handleClickNote,
    handleCreateNote,
    handleListKeyDown,
    multiSelect,
    noteListKeyboard,
    toggleGroup,
  } = useNoteListInteractions({
    searched,
    selectedNotePath: selectedNote?.path ?? null,
    selection,
    noteListFilter,
    isEntityView,
    isChangesView,
    onReplaceActiveTab,
    onSelectNote,
    onOpenDeletedNote,
    onOpenInNewWindow,
    onAutoTriggerDiff,
    onDiscardFile,
    openContextMenuForEntry: changesContextMenu.openContextMenuForEntry,
    onCreateNote,
  })
  const getChangeStatus = useChangeStatusResolver(isChangesView, modifiedFiles)

  const {
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
  } = useBulkActions(multiSelect, onBulkArchive, onBulkDeletePermanently, isArchivedView)

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem
      key={entry.path}
      entry={entry}
      isSelected={selectedNote?.path === entry.path}
      isMultiSelected={multiSelect.selectedPaths.has(entry.path)}
      isHighlighted={entry.path === noteListKeyboard.highlightedPath}
      noteStatus={resolvedGetNoteStatus(entry.path)}
      changeStatus={getChangeStatus(entry.path)}
      typeEntryMap={typeEntryMap}
      allEntries={entries}
      displayPropsOverride={inboxDisplayOverride}
      onClickNote={handleClickNote}
      onContextMenu={isChangesView && onDiscardFile ? changesContextMenu.handleNoteContextMenu : undefined}
    />
  ), [
    entries,
    selectedNote?.path,
    multiSelect.selectedPaths,
    noteListKeyboard.highlightedPath,
    resolvedGetNoteStatus,
    getChangeStatus,
    typeEntryMap,
    inboxDisplayOverride,
    handleClickNote,
    isChangesView,
    onDiscardFile,
    changesContextMenu.handleNoteContextMenu,
  ])

  return {
    title: resolveHeaderTitle(selection, typeDocument, views),
    typeDocument,
    isEntityView,
    listSort,
    listDirection,
    customProperties,
    sidebarCollapsed,
    searchVisible,
    search,
    propertyPicker,
    handleSortChange,
    handleCreateNote,
    onOpenType: onReplaceActiveTab,
    toggleSearch,
    setSearch,
    handleListKeyDown,
    noteListKeyboard,
    entitySelection: isEntityView && selection.kind === 'entity' ? selection : null,
    searchedGroups,
    collapsedGroups,
    sortPrefs,
    toggleGroup,
    renderItem,
    typeEntryMap,
    handleClickNote,
    isArchivedView,
    isChangesView,
    isInboxView,
    modifiedFilesError,
    searched,
    query,
    showFilterPills,
    noteListFilter,
    filterCounts,
    onNoteListFilterChange,
    multiSelect,
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
    contextMenuNode: changesContextMenu.contextMenuNode,
    dialogNode: changesContextMenu.dialogNode,
  }
}
