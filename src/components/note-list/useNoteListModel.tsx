import { useMemo, useCallback } from 'react'
import type {
  VaultEntry,
  SidebarSelection,
  ModifiedFile,
  NoteStatus,
  InboxPeriod,
  ViewDefinition,
  ViewFile,
} from '../../types'
import type { NoteListFilter } from '../../utils/noteListHelpers'
import { countByFilter, countAllByFilter, countAllNotesByFilter } from '../../utils/noteListHelpers'
import { NoteItem } from '../NoteItem'
import type { MultiSelectState } from '../../hooks/useMultiSelect'
import { resolveHeaderTitle, type DeletedNoteEntry } from './noteListUtils'
import { filterEntriesByNoteListQuery, filterGroupsByNoteListQuery } from './noteListSearch'
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

type EntitySelection = Extract<SidebarSelection, { kind: 'entity' }>

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
    if (selection.kind === 'filter' && selection.filter === 'all') return countAllNotesByFilter(entries)
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
  onUpdateViewDefinition?: (filename: string, patch: Partial<ViewDefinition>) => void
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
  onUpdateViewDefinition,
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
    views,
    onUpdateTypeSort,
    onUpdateViewDefinition,
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
    onUpdateViewDefinition,
    onUpdateTypeSort,
    views,
  })
  const {
    isEntityView,
    isArchivedView,
    searched: sortedEntries,
    searchedGroups: sortedGroups,
  } = useNoteListData({
    entries,
    selection,
    query: '',
    listSort,
    listDirection,
    modifiedPathSet,
    modifiedSuffixes,
    modifiedFiles,
    subFilter,
    inboxPeriod: effectiveInboxPeriod,
    views,
  })
  const searched = useMemo(() => filterEntriesByNoteListQuery(sortedEntries, query, {
    allEntries: entries,
    typeEntryMap,
    displayPropsOverride,
  }), [displayPropsOverride, entries, query, sortedEntries, typeEntryMap])
  const searchedGroups = useMemo(() => filterGroupsByNoteListQuery(sortedGroups, query, {
    allEntries: entries,
    typeEntryMap,
    displayPropsOverride,
  }), [displayPropsOverride, entries, query, sortedGroups, typeEntryMap])
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
  getChangeStatus: (path: string) => ModifiedFile['status'] | undefined
  handleClickNote: (entry: VaultEntry, event: React.MouseEvent) => void
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
  onUpdateViewDefinition?: (filename: string, patch: Partial<ViewDefinition>) => void
  views?: ViewFile[]
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
}

function buildNoteListLayoutModel(params: {
  selection: SidebarSelection
  views?: ViewFile[]
  sidebarCollapsed?: boolean
  modifiedFilesError?: string | null
  noteListFilter: NoteListFilter
  filterCounts: ReturnType<typeof useFilterCounts>
  onNoteListFilterChange: (filter: NoteListFilter) => void
  onOpenType: (entry: VaultEntry) => void
  content: ReturnType<typeof useNoteListContent>
  interaction: ReturnType<typeof useNoteListInteractionState> & {
    renderItem: (entry: VaultEntry) => React.ReactNode
    entitySelection: EntitySelection | null
  }
}) {
  return {
    title: resolveHeaderTitle(params.selection, params.content.typeDocument, params.views),
    typeDocument: params.content.typeDocument,
    isEntityView: params.content.isEntityView,
    listSort: params.content.listSort,
    listDirection: params.content.listDirection,
    customProperties: params.content.customProperties,
    sidebarCollapsed: params.sidebarCollapsed,
    searchVisible: params.content.searchVisible,
    search: params.content.search,
    propertyPicker: params.content.propertyPicker,
    handleSortChange: params.content.handleSortChange,
    handleCreateNote: params.interaction.handleCreateNote,
    onOpenType: params.onOpenType,
    toggleSearch: params.content.toggleSearch,
    setSearch: params.content.setSearch,
    handleListKeyDown: params.interaction.handleListKeyDown,
    noteListContainerRef: params.interaction.noteListKeyboard.containerRef,
    handleNoteListBlur: params.interaction.noteListKeyboard.handleBlur,
    handleNoteListFocus: params.interaction.noteListKeyboard.handleFocus,
    focusNoteList: params.interaction.noteListKeyboard.focusList,
    noteListVirtuosoRef: params.interaction.noteListKeyboard.virtuosoRef,
    entitySelection: params.interaction.entitySelection,
    searchedGroups: params.content.searchedGroups,
    collapsedGroups: params.interaction.collapsedGroups,
    sortPrefs: params.content.sortPrefs,
    toggleGroup: params.interaction.toggleGroup,
    renderItem: params.interaction.renderItem,
    typeEntryMap: params.content.typeEntryMap,
    handleClickNote: params.interaction.handleClickNote,
    isArchivedView: params.content.isArchivedView,
    isChangesView: params.selection.kind === 'filter' && params.selection.filter === 'changes',
    isInboxView: params.selection.kind === 'filter' && params.selection.filter === 'inbox',
    modifiedFilesError: params.modifiedFilesError,
    searched: params.content.searched,
    query: params.content.query,
    showFilterPills: params.selection.kind === 'sectionGroup' || params.selection.kind === 'folder',
    noteListFilter: params.noteListFilter,
    filterCounts: params.filterCounts,
    onNoteListFilterChange: params.onNoteListFilterChange,
    multiSelect: params.interaction.multiSelect,
    handleBulkArchive: params.interaction.handleBulkArchive,
    handleBulkDeletePermanently: params.interaction.handleBulkDeletePermanently,
    handleBulkUnarchive: params.interaction.handleBulkUnarchive,
    contextMenuNode: params.interaction.changesContextMenu.contextMenuNode,
    dialogNode: params.interaction.changesContextMenu.dialogNode,
  }
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
  onUpdateViewDefinition,
  views,
  visibleNotesRef,
}: NoteListProps) {
  const selectedNotePath = selectedNote?.path ?? null
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)
  const { isInboxView } = useViewFlags(selection)
  const filterCounts = useFilterCounts(entries, selection)
  const content = useNoteListContent({
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
    onUpdateViewDefinition,
    onUpdateTypeSort,
    updateEntry,
    views,
    visibleNotesRef,
  })
  const interaction = useNoteListInteractionState({
    searched: content.searched,
    selectedNotePath,
    selection,
    noteListFilter,
    isArchivedView: content.isArchivedView,
    isEntityView: content.isEntityView,
    isChangesView: selection.kind === 'filter' && selection.filter === 'changes',
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
    selectedNotePath,
    typeEntryMap: content.typeEntryMap,
    displayPropsOverride: content.displayPropsOverride,
    isChangesView: selection.kind === 'filter' && selection.filter === 'changes',
    onDiscardFile,
    resolvedGetNoteStatus,
    getChangeStatus: interaction.getChangeStatus,
    handleClickNote: interaction.handleClickNote,
    noteContextMenu: interaction.changesContextMenu.handleNoteContextMenu,
    multiSelect: interaction.multiSelect,
    noteListKeyboard: interaction.noteListKeyboard,
  })

  return buildNoteListLayoutModel({
    selection,
    views,
    sidebarCollapsed,
    onOpenType: onReplaceActiveTab,
    modifiedFilesError,
    noteListFilter,
    filterCounts,
    onNoteListFilterChange,
    content,
    interaction: {
      ...interaction,
      renderItem,
      entitySelection: content.isEntityView && selection.kind === 'entity' ? selection : null,
    },
  })
}
