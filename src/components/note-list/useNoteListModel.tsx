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

function useFilterCounts(entries: VaultEntry[], selection: SidebarSelection) {
  return useMemo(() => {
    if (selection.kind === 'sectionGroup') return countByFilter(entries, selection.type)
    if (selection.kind === 'folder') return countAllByFilter(entries)
    if (selection.kind === 'filter' && selection.filter === 'all') return countAllByFilter(entries)
    return { open: 0, archived: 0 }
  }, [entries, selection])
}

interface UseNoteListContentParams {
  entries: VaultEntry[]
  selection: SidebarSelection
  noteListFilter: NoteListFilter
  inboxPeriod: InboxPeriod
  modifiedFiles?: ModifiedFile[]
  modifiedSuffixes: string[]
  modifiedPathSet: Set<string>
  isInboxView: boolean
  allNotesNoteListProperties?: string[] | null
  onUpdateAllNotesNoteListProperties?: (value: string[] | null) => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: (value: string[] | null) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
  views?: ViewFile[]
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
}

function useNoteListContent({
  entries,
  selection,
  noteListFilter,
  inboxPeriod,
  modifiedFiles,
  modifiedSuffixes,
  modifiedPathSet,
  isInboxView,
  allNotesNoteListProperties,
  onUpdateAllNotesNoteListProperties,
  inboxNoteListProperties,
  onUpdateInboxNoteListProperties,
  onUpdateTypeSort,
  updateEntry,
  views,
  visibleNotesRef,
}: UseNoteListContentParams) {
  const subFilter = (selection.kind === 'sectionGroup' || selection.kind === 'folder')
    ? noteListFilter
    : undefined
  const effectiveInboxPeriod = isInboxView ? inboxPeriod : undefined
  const { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument } = useNoteListSort({
    entries,
    selection,
    modifiedPathSet,
    modifiedSuffixes,
    subFilter,
    inboxPeriod: effectiveInboxPeriod,
    onUpdateTypeSort,
    updateEntry,
  })
  const { search, setSearch, query, searchVisible, toggleSearch } = useNoteListSearch()
  const typeEntryMap = useTypeEntryMap(entries)
  const { displayPropsOverride, propertyPicker } = useListPropertyPicker({
    entries,
    selection,
    inboxPeriod,
    typeDocument,
    typeEntryMap,
    allNotesNoteListProperties,
    onUpdateAllNotesNoteListProperties,
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
    inboxPeriod: effectiveInboxPeriod,
    views,
  })
  useVisibleNotesSync({ visibleNotesRef, isEntityView, searched, searchedGroups })

  return {
    customProperties,
    displayPropsOverride,
    handleSortChange,
    isArchivedView,
    isEntityView,
    listDirection,
    listSort,
    propertyPicker,
    query,
    search,
    searchVisible,
    searched,
    searchedGroups,
    setSearch,
    sortPrefs,
    toggleSearch,
    typeDocument,
    typeEntryMap,
  }
}

interface UseNoteListInteractionStateParams {
  searched: VaultEntry[]
  selectedNotePath: string | null
  selection: SidebarSelection
  noteListFilter: NoteListFilter
  isArchivedView: boolean
  isChangesView: boolean
  isEntityView: boolean
  modifiedFiles?: ModifiedFile[]
  onReplaceActiveTab: (entry: VaultEntry) => void
  onSelectNote: (entry: VaultEntry) => void
  onOpenDeletedNote?: (entry: DeletedNoteEntry) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onAutoTriggerDiff?: () => void
  onDiscardFile?: (relativePath: string) => Promise<void>
  onCreateNote: (type?: string) => void
  onBulkArchive?: (paths: string[]) => void
  onBulkDeletePermanently?: (paths: string[]) => void
}

function useNoteListInteractionState({
  searched,
  selectedNotePath,
  selection,
  noteListFilter,
  isArchivedView,
  isChangesView,
  isEntityView,
  modifiedFiles,
  onReplaceActiveTab,
  onSelectNote,
  onOpenDeletedNote,
  onOpenInNewWindow,
  onAutoTriggerDiff,
  onDiscardFile,
  onCreateNote,
  onBulkArchive,
  onBulkDeletePermanently,
}: UseNoteListInteractionStateParams) {
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
    selectedNotePath,
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

  return {
    changesContextMenu,
    collapsedGroups,
    getChangeStatus,
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
    handleClickNote,
    handleCreateNote,
    handleListKeyDown,
    multiSelect,
    noteListKeyboard,
    toggleGroup,
  }
}

interface UseRenderItemParams {
  entries: VaultEntry[]
  selectedNotePath: string | null
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  isChangesView: boolean
  onDiscardFile?: (relativePath: string) => Promise<void>
  resolvedGetNoteStatus: (path: string) => NoteStatus
  getChangeStatus: (path: string) => string | undefined
  handleClickNote: (entry: VaultEntry, event?: React.MouseEvent) => void
  noteContextMenu?: ((entry: VaultEntry, event: React.MouseEvent) => void) | undefined
  multiSelect: MultiSelectState
  noteListKeyboard: { highlightedPath: string | null }
}

function useRenderItem({
  entries,
  selectedNotePath,
  typeEntryMap,
  displayPropsOverride,
  isChangesView,
  onDiscardFile,
  resolvedGetNoteStatus,
  getChangeStatus,
  handleClickNote,
  noteContextMenu,
  multiSelect,
  noteListKeyboard,
}: UseRenderItemParams) {
  const contextMenuHandler = isChangesView && onDiscardFile ? noteContextMenu : undefined

  return useCallback((entry: VaultEntry) => (
    <NoteItem
      key={entry.path}
      entry={entry}
      isSelected={selectedNotePath === entry.path}
      isMultiSelected={multiSelect.selectedPaths.has(entry.path)}
      isHighlighted={entry.path === noteListKeyboard.highlightedPath}
      noteStatus={resolvedGetNoteStatus(entry.path)}
      changeStatus={getChangeStatus(entry.path)}
      typeEntryMap={typeEntryMap}
      allEntries={entries}
      displayPropsOverride={displayPropsOverride}
      onClickNote={handleClickNote}
      onContextMenu={contextMenuHandler}
    />
  ), [
    contextMenuHandler,
    displayPropsOverride,
    entries,
    getChangeStatus,
    handleClickNote,
    multiSelect.selectedPaths,
    noteListKeyboard.highlightedPath,
    resolvedGetNoteStatus,
    selectedNotePath,
    typeEntryMap,
  ])
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
  allNotesNoteListProperties?: string[] | null
  onUpdateAllNotesNoteListProperties?: (value: string[] | null) => void
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
  allNotesNoteListProperties,
  onUpdateAllNotesNoteListProperties,
  inboxNoteListProperties,
  onUpdateInboxNoteListProperties,
  views,
  visibleNotesRef,
}: NoteListProps) {
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)
  const { isInboxView, isChangesView, showFilterPills } = useViewFlags(selection)
  const filterCounts = useFilterCounts(entries, selection)
  const {
    customProperties,
    displayPropsOverride,
    handleSortChange,
    isArchivedView,
    isEntityView,
    listDirection,
    listSort,
    propertyPicker,
    query,
    search,
    searchVisible,
    searched,
    searchedGroups,
    setSearch,
    sortPrefs,
    toggleSearch,
    typeDocument,
    typeEntryMap,
  } = useNoteListContent({
    entries,
    selection,
    noteListFilter,
    inboxPeriod,
    modifiedFiles,
    modifiedSuffixes,
    modifiedPathSet,
    isInboxView,
    allNotesNoteListProperties,
    onUpdateAllNotesNoteListProperties,
    inboxNoteListProperties,
    onUpdateInboxNoteListProperties,
    onUpdateTypeSort,
    updateEntry,
    views,
    visibleNotesRef,
  })
  const {
    changesContextMenu,
    collapsedGroups,
    getChangeStatus,
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
    handleClickNote,
    handleCreateNote,
    handleListKeyDown,
    multiSelect,
    noteListKeyboard,
    toggleGroup,
  } = useNoteListInteractionState({
    searched,
    selectedNotePath: selectedNote?.path ?? null,
    selection,
    noteListFilter,
    isArchivedView,
    isEntityView,
    isChangesView,
    modifiedFiles,
    onReplaceActiveTab,
    onSelectNote,
    onOpenDeletedNote,
    onOpenInNewWindow,
    onAutoTriggerDiff,
    onDiscardFile,
    onCreateNote,
    onBulkArchive,
    onBulkDeletePermanently,
  })
  const renderItem = useRenderItem({
    entries,
    selectedNotePath: selectedNote?.path ?? null,
    typeEntryMap,
    displayPropsOverride,
    isChangesView,
    onDiscardFile,
    resolvedGetNoteStatus,
    getChangeStatus,
    handleClickNote,
    noteContextMenu: changesContextMenu.handleNoteContextMenu,
    multiSelect,
    noteListKeyboard,
  })

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
