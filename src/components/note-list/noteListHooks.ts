import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus, ViewFile } from '../../types'
import {
  type SortOption, type SortDirection, type SortConfig, type NoteListFilter,
  getSortComparator, extractSortableProperties,
  buildRelationshipGroups, filterEntries, filterInboxEntries,
  loadSortPreferences, saveSortPreferences,
  parseSortConfig, serializeSortConfig, clearListSortFromLocalStorage,
} from '../../utils/noteListHelpers'
import type { InboxPeriod } from '../../types'
import { buildTypeEntryMap } from '../../utils/typeColors'
import {
  buildChangesEntries, filterByQuery, filterGroupsByQuery, createNoteStatusResolver,
  isDeletedNoteEntry, isModifiedEntry, routeNoteClick, toggleSetMember,
} from './noteListUtils'
import type { DeletedNoteEntry } from './noteListUtils'
import { useMultiSelect, type MultiSelectState } from '../../hooks/useMultiSelect'
import { useNoteListKeyboard } from '../../hooks/useNoteListKeyboard'
import { prefetchNoteContent } from '../../hooks/useTabManagement'
import type { NoteListPropertiesScope } from './noteListPropertiesEvents'

// --- useTypeEntryMap ---

export function useTypeEntryMap(entries: VaultEntry[]) {
  return useMemo(() => buildTypeEntryMap(entries), [entries])
}

// --- useFilteredEntries ---

interface FilteredEntriesParams {
  entries: VaultEntry[]
  selection: SidebarSelection
  modifiedPathSet: Set<string>
  modifiedSuffixes: string[]
  modifiedFiles?: ModifiedFile[]
  subFilter?: NoteListFilter
  inboxPeriod?: InboxPeriod
  views?: ViewFile[]
}

function buildFilteredEntries({
  entries,
  selection,
  isEntityView,
  isChangesView,
  isInboxView,
  modifiedPathSet,
  modifiedSuffixes,
  modifiedFiles,
  subFilter,
  inboxPeriod,
  views,
}: FilteredEntriesParams & {
  isEntityView: boolean
  isChangesView: boolean
  isInboxView: boolean
}) {
  if (isEntityView) return []
  if (isChangesView) {
    if (modifiedFiles) return buildChangesEntries(entries, modifiedFiles)
    return entries.filter((entry) => isModifiedEntry(entry.path, modifiedPathSet, modifiedSuffixes))
  }
  if (isInboxView) return filterInboxEntries(entries, inboxPeriod ?? 'month')
  return filterEntries(entries, selection, subFilter, views)
}

export function useFilteredEntries({
  entries,
  selection,
  modifiedPathSet,
  modifiedSuffixes,
  modifiedFiles,
  subFilter,
  inboxPeriod,
  views,
}: FilteredEntriesParams) {
  const isEntityView = selection.kind === 'entity'
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const isInboxView = selection.kind === 'filter' && selection.filter === 'inbox'
  return useMemo(() => {
    return buildFilteredEntries({
      entries,
      selection,
      isEntityView,
      isChangesView,
      isInboxView,
      modifiedPathSet,
      modifiedSuffixes,
      modifiedFiles,
      subFilter,
      inboxPeriod,
      views,
    })
  }, [entries, inboxPeriod, isChangesView, isEntityView, isInboxView, modifiedFiles, modifiedPathSet, modifiedSuffixes, selection, subFilter, views])
}

// --- useNoteListData ---

interface NoteListDataParams {
  entries: VaultEntry[]; selection: SidebarSelection
  query: string; listSort: SortOption; listDirection: SortDirection
  modifiedPathSet: Set<string>; modifiedSuffixes: string[]
  modifiedFiles?: ModifiedFile[]
  subFilter?: NoteListFilter
  inboxPeriod?: InboxPeriod
  views?: ViewFile[]
}

export function useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes, modifiedFiles, subFilter, inboxPeriod, views }: NoteListDataParams) {
  const isEntityView = selection.kind === 'entity'
  const isArchivedView = (selection.kind === 'filter' && selection.filter === 'archived') || subFilter === 'archived'

  const filteredEntries = useFilteredEntries({
    entries,
    selection,
    modifiedPathSet,
    modifiedSuffixes,
    modifiedFiles,
    subFilter,
    inboxPeriod,
    views,
  })

  const searched = useMemo(() => {
    const sorted = [...filteredEntries].sort(getSortComparator(listSort, listDirection))
    return filterByQuery(sorted, query)
  }, [filteredEntries, listSort, listDirection, query])

  const searchedGroups = useMemo(() => {
    if (!isEntityView) return []
    // Look up the fresh entry from the entries array to pick up relationship
    // updates that happened after the selection was captured.
    const freshEntry = entries.find((e) => e.path === selection.entry.path) ?? selection.entry
    const groups = buildRelationshipGroups(freshEntry, entries)
    return filterGroupsByQuery(groups, query)
  }, [isEntityView, selection, entries, query])

  return { isEntityView, isArchivedView, searched, searchedGroups }
}

// --- useNoteListSearch ---

export function useNoteListSearch() {
  const [search, setSearch] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const query = search.trim().toLowerCase()

  const toggleSearch = useCallback(() => {
    setSearchVisible((v) => { if (v) setSearch(''); return !v })
  }, [])

  return { search, setSearch, query, searchVisible, toggleSearch }
}

// --- useNoteListSort ---

const DEFAULT_LIST_CONFIG: SortConfig = { option: 'modified', direction: 'desc' }

function resolveListSortConfig(typeDocument: VaultEntry | null, sortPrefs: Record<string, SortConfig>): SortConfig {
  if (typeDocument?.sort) {
    const parsed = parseSortConfig(typeDocument.sort)
    if (parsed) return parsed
  }
  return sortPrefs['__list__'] ?? DEFAULT_LIST_CONFIG
}

interface SortPersistence {
  onUpdateTypeSort: (path: string, key: string, value: string) => void
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
}

function persistSortToType(path: string, config: SortConfig, persistence: SortPersistence) {
  const serialized = serializeSortConfig(config)
  persistence.onUpdateTypeSort(path, 'sort', serialized)
  persistence.updateEntry(path, { sort: serialized })
  clearListSortFromLocalStorage()
}

function resolveTypeSortPersistenceTarget(groupLabel: string, typeDocument: VaultEntry | null, persistence: SortPersistence | null) {
  if (groupLabel !== '__list__' || !typeDocument || !persistence) return null
  return { path: typeDocument.path, persistence }
}

function migrateListSortToType(typeDoc: VaultEntry, sortPrefs: Record<string, SortConfig>, migrationDone: Set<string>, persistence: SortPersistence) {
  if (typeDoc.sort || migrationDone.has(typeDoc.path)) return
  const lsConfig = sortPrefs['__list__']
  if (!lsConfig) return
  migrationDone.add(typeDoc.path)
  persistSortToType(typeDoc.path, lsConfig, persistence)
}

function saveGroupSort(groupLabel: string, option: SortOption, direction: SortDirection, setSortPrefs: React.Dispatch<React.SetStateAction<Record<string, SortConfig>>>) {
  setSortPrefs((prev) => { const next = { ...prev, [groupLabel]: { option, direction } }; saveSortPreferences(next); return next })
}

function deriveEffectiveSort(configOption: SortOption, customProperties: string[]): SortOption {
  if (!configOption.startsWith('property:')) return configOption
  return customProperties.includes(configOption.slice('property:'.length)) ? configOption : 'modified'
}

export interface UseNoteListSortParams {
  entries: VaultEntry[]
  selection: SidebarSelection
  modifiedPathSet: Set<string>
  modifiedSuffixes: string[]
  subFilter?: NoteListFilter
  inboxPeriod?: InboxPeriod
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
}

export function useNoteListSort({ entries, selection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod, onUpdateTypeSort, updateEntry }: UseNoteListSortParams) {
  const [sortPrefs, setSortPrefs] = useState<Record<string, SortConfig>>(loadSortPreferences)

  const typeDocument = useMemo(() => {
    if (selection.kind !== 'sectionGroup') return null
    return entries.find((e) => e.isA === 'Type' && e.title === selection.type) ?? null
  }, [selection, entries])

  const listConfig = resolveListSortConfig(typeDocument, sortPrefs)
  const persistence = useMemo<SortPersistence | null>(
    () => (onUpdateTypeSort && updateEntry) ? { onUpdateTypeSort, updateEntry } : null,
    [onUpdateTypeSort, updateEntry],
  )

  const migrationDoneRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!typeDocument || !persistence) return
    migrateListSortToType(typeDocument, sortPrefs, migrationDoneRef.current, persistence)
  }, [typeDocument, sortPrefs, persistence])

  const handleSortChange = useCallback((groupLabel: string, option: SortOption, direction: SortDirection) => {
    const typeSortTarget = resolveTypeSortPersistenceTarget(groupLabel, typeDocument, persistence)
    if (!typeSortTarget) return saveGroupSort(groupLabel, option, direction, setSortPrefs)
    persistSortToType(typeSortTarget.path, { option, direction }, typeSortTarget.persistence)
  }, [typeDocument, persistence])

  const filteredEntries = useFilteredEntries({
    entries,
    selection,
    modifiedPathSet,
    modifiedSuffixes,
    subFilter,
    inboxPeriod,
  })
  const customProperties = useMemo(() => extractSortableProperties(filteredEntries), [filteredEntries])
  const listSort = useMemo<SortOption>(() => deriveEffectiveSort(listConfig.option, customProperties), [listConfig.option, customProperties])
  const listDirection = listSort === listConfig.option ? listConfig.direction : 'desc'

  return { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument }
}

// --- useMultiSelectKeyboard ---

function isInputFocused(): boolean {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || !!(el as HTMLElement)?.isContentEditable
}

function handleEscapeKey(e: KeyboardEvent, multiSelect: MultiSelectState) {
  if (e.key !== 'Escape' || !multiSelect.isMultiSelecting) return
  e.preventDefault()
  multiSelect.clear()
}

function handleSelectAllKey(e: KeyboardEvent, multiSelect: MultiSelectState, isEntityView: boolean) {
  if (e.key !== 'a' || !(e.metaKey || e.ctrlKey) || isEntityView || isInputFocused()) return
  e.preventDefault()
  multiSelect.selectAll()
}

function handleBulkActionKey(e: KeyboardEvent, multiSelect: MultiSelectState, onArchive: () => void, onDelete: () => void) {
  if (!multiSelect.isMultiSelecting || !(e.metaKey || e.ctrlKey)) return
  if (e.key === 'e') { e.preventDefault(); e.stopPropagation(); onArchive() }
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); onDelete() }
}

export function useMultiSelectKeyboard(multiSelect: MultiSelectState, isEntityView: boolean, onBulkArchive: () => void, onBulkDelete: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      handleEscapeKey(e, multiSelect)
      handleSelectAllKey(e, multiSelect, isEntityView)
      handleBulkActionKey(e, multiSelect, onBulkArchive, onBulkDelete)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [multiSelect, isEntityView, onBulkArchive, onBulkDelete])
}

// --- useModifiedFilesState ---

export function useModifiedFilesState(modifiedFiles: ModifiedFile[] | undefined, getNoteStatus: ((path: string) => NoteStatus) | undefined) {
  const modifiedPathSet = useMemo(() => new Set((modifiedFiles ?? []).map((f) => f.path)), [modifiedFiles])
  const modifiedSuffixes = useMemo(() => (modifiedFiles ?? []).map((f) => '/' + f.relativePath), [modifiedFiles])
  const resolvedGetNoteStatus = useMemo<(path: string) => NoteStatus>(
    () => createNoteStatusResolver(getNoteStatus, modifiedFiles, modifiedPathSet),
    [getNoteStatus, modifiedFiles, modifiedPathSet],
  )
  return { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus }
}

// --- useChangeStatusResolver ---

function buildChangeStatusMap(isChangesView: boolean, modifiedFiles?: ModifiedFile[]) {
  if (!isChangesView || !modifiedFiles) return undefined

  const map = new Map<string, ModifiedFile['status']>()
  for (const file of modifiedFiles) {
    map.set(file.path, file.status)
    map.set('/' + file.relativePath, file.status)
  }

  return map
}

function resolveChangeStatus(path: string, changeStatusMap?: Map<string, ModifiedFile['status']>) {
  if (!changeStatusMap) return undefined

  const direct = changeStatusMap.get(path)
  if (direct) return direct

  const filename = path.split('/').slice(-1)[0]
  for (const [key, status] of changeStatusMap) {
    if (path.endsWith(key) || key.endsWith(filename)) return status
  }

  return undefined
}

export function useChangeStatusResolver(isChangesView: boolean, modifiedFiles?: ModifiedFile[]) {
  const changeStatusMap = useMemo(
    () => buildChangeStatusMap(isChangesView, modifiedFiles),
    [isChangesView, modifiedFiles],
  )

  return useCallback(
    (path: string) => resolveChangeStatus(path, changeStatusMap),
    [changeStatusMap],
  )
}

// --- useVisibleNotesSync ---

interface VisibleNotesSyncParams {
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
  isEntityView: boolean
  searched: VaultEntry[]
  searchedGroups: Array<{ entries: VaultEntry[] }>
}

export function useVisibleNotesSync({ visibleNotesRef, isEntityView, searched, searchedGroups }: VisibleNotesSyncParams) {
  useEffect(() => {
    if (!visibleNotesRef) return

    visibleNotesRef.current = isEntityView
      ? searchedGroups.flatMap((group) => group.entries).filter((entry) => !isDeletedNoteEntry(entry))
      : searched.filter((entry) => !isDeletedNoteEntry(entry))
  }, [visibleNotesRef, isEntityView, searched, searchedGroups])
}

// --- useListPropertyPicker ---

function hasScalarListPropertyValue(value: string | null): boolean {
  return value !== null && value.trim() !== ''
}

function collectAvailableProperties(entries: VaultEntry[]): string[] {
  const keys = new Set<string>()
  for (const entry of entries) {
    if (hasScalarListPropertyValue(entry.status)) keys.add('status')
    for (const key of Object.keys(entry.properties ?? {})) keys.add(key)
    for (const key of Object.keys(entry.relationships ?? {})) keys.add(key)
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

function collectTypeAvailableProperties(entries: VaultEntry[], typeName: string): string[] {
  return collectAvailableProperties(entries.filter((entry) => entry.isA === typeName))
}

function deriveDefaultDisplay(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    for (const key of typeEntryMap[entry.isA ?? '']?.listPropertiesDisplay ?? []) {
      if (seen.has(key)) continue
      seen.add(key)
      ordered.push(key)
    }
  }

  return ordered
}

export interface NoteListPropertyPicker {
  scope: NoteListPropertiesScope
  availableProperties: string[]
  currentDisplay: string[]
  onSave: (value: string[] | null) => void
  triggerTitle: string
}

interface BuildFilterPropertyPickerParams {
  scope: Exclude<NoteListPropertiesScope, 'type'>
  isActive: boolean
  availableProperties: string[]
  hasCustomProperties: boolean
  noteListProperties?: string[] | null
  defaultDisplay: string[]
  onSave?: (value: string[] | null) => void
  triggerTitle: string
}

function buildFilterPropertyPicker({
  scope,
  isActive,
  availableProperties,
  hasCustomProperties,
  noteListProperties,
  defaultDisplay,
  onSave,
  triggerTitle,
}: BuildFilterPropertyPickerParams): NoteListPropertyPicker | null {
  if (!isActive || !onSave) return null

  return {
    scope,
    availableProperties,
    currentDisplay: hasCustomProperties ? noteListProperties ?? [] : defaultDisplay,
    onSave,
    triggerTitle,
  }
}

interface BuildTypePropertyPickerParams {
  isSectionGroup: boolean
  typeDocument: VaultEntry | null
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  typeAvailableProperties: string[]
}

function buildTypePropertyPicker({
  isSectionGroup,
  typeDocument,
  onUpdateTypeSort,
  typeAvailableProperties,
}: BuildTypePropertyPickerParams): NoteListPropertyPicker | null {
  if (!isSectionGroup || !typeDocument || !onUpdateTypeSort) return null

  return {
    scope: 'type',
    availableProperties: typeAvailableProperties,
    currentDisplay: typeDocument.listPropertiesDisplay ?? [],
    onSave: (value: string[] | null) => onUpdateTypeSort(typeDocument.path, '_list_properties_display', value),
    triggerTitle: 'Customize columns',
  }
}

interface UseListPropertyPickerParams {
  entries: VaultEntry[]
  selection: SidebarSelection
  inboxPeriod: InboxPeriod
  typeDocument: VaultEntry | null
  typeEntryMap: Record<string, VaultEntry>
  allNotesNoteListProperties?: string[] | null
  onUpdateAllNotesNoteListProperties?: (value: string[] | null) => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: (value: string[] | null) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
}

export function useListPropertyPicker({
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
}: UseListPropertyPickerParams) {
  const isAllNotesView = selection.kind === 'filter' && selection.filter === 'all'
  const isInboxView = selection.kind === 'filter' && selection.filter === 'inbox'
  const isSectionGroup = selection.kind === 'sectionGroup'

  const allNotesEntries = useMemo(
    () => isAllNotesView
      ? [
          ...filterEntries(entries, selection, 'open'),
          ...filterEntries(entries, selection, 'archived'),
        ]
      : [],
    [entries, isAllNotesView, selection],
  )
  const inboxEntries = useMemo(
    () => isInboxView ? filterInboxEntries(entries, inboxPeriod) : [],
    [entries, inboxPeriod, isInboxView],
  )
  const allNotesAvailableProperties = useMemo(
    () => collectAvailableProperties(allNotesEntries),
    [allNotesEntries],
  )
  const allNotesDefaultDisplay = useMemo(
    () => deriveDefaultDisplay(allNotesEntries, typeEntryMap),
    [allNotesEntries, typeEntryMap],
  )
  const typeAvailableProperties = useMemo(
    () => typeDocument ? collectTypeAvailableProperties(entries, typeDocument.title) : [],
    [entries, typeDocument],
  )
  const inboxAvailableProperties = useMemo(
    () => collectAvailableProperties(inboxEntries),
    [inboxEntries],
  )
  const inboxDefaultDisplay = useMemo(
    () => deriveDefaultDisplay(inboxEntries, typeEntryMap),
    [inboxEntries, typeEntryMap],
  )
  const hasCustomAllNotesProperties = !!(allNotesNoteListProperties && allNotesNoteListProperties.length > 0)
  const hasCustomInboxProperties = !!(inboxNoteListProperties && inboxNoteListProperties.length > 0)
  const displayPropsOverride = isAllNotesView && hasCustomAllNotesProperties
    ? allNotesNoteListProperties
    : (isInboxView && hasCustomInboxProperties ? inboxNoteListProperties : null)

  const propertyPicker = useMemo<NoteListPropertyPicker | null>(() => {
    return buildFilterPropertyPicker({
      scope: 'all',
      isActive: isAllNotesView,
      availableProperties: allNotesAvailableProperties,
      hasCustomProperties: hasCustomAllNotesProperties,
      noteListProperties: allNotesNoteListProperties,
      defaultDisplay: allNotesDefaultDisplay,
      onSave: onUpdateAllNotesNoteListProperties,
      triggerTitle: 'Customize All Notes columns',
    }) ?? buildFilterPropertyPicker({
      scope: 'inbox',
      isActive: isInboxView,
      availableProperties: inboxAvailableProperties,
      hasCustomProperties: hasCustomInboxProperties,
      noteListProperties: inboxNoteListProperties,
      defaultDisplay: inboxDefaultDisplay,
      onSave: onUpdateInboxNoteListProperties,
      triggerTitle: 'Customize Inbox columns',
    }) ?? buildTypePropertyPicker({
      isSectionGroup,
      typeDocument,
      onUpdateTypeSort,
      typeAvailableProperties,
    })
  }, [
    allNotesAvailableProperties,
    allNotesDefaultDisplay,
    allNotesNoteListProperties,
    hasCustomAllNotesProperties,
    isAllNotesView,
    onUpdateAllNotesNoteListProperties,
    hasCustomInboxProperties,
    inboxAvailableProperties,
    inboxDefaultDisplay,
    inboxNoteListProperties,
    isInboxView,
    isSectionGroup,
    onUpdateInboxNoteListProperties,
    onUpdateTypeSort,
    typeAvailableProperties,
    typeDocument,
  ])

  return { displayPropsOverride, propertyPicker }
}

// --- useNoteListInteractions ---

interface UseNoteListInteractionsParams {
  searched: VaultEntry[]
  selectedNotePath: string | null
  selection: SidebarSelection
  noteListFilter: NoteListFilter
  isEntityView: boolean
  isChangesView: boolean
  onReplaceActiveTab: (entry: VaultEntry) => void
  onSelectNote: (entry: VaultEntry) => void
  onOpenDeletedNote?: (entry: DeletedNoteEntry) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onAutoTriggerDiff?: () => void
  onDiscardFile?: (relativePath: string) => Promise<void>
  openContextMenuForEntry: (entry: VaultEntry, point: { x: number; y: number }) => void
  onCreateNote: (type?: string) => void
}

function resolveChangesContextMenuEntry(
  event: React.KeyboardEvent<HTMLDivElement>,
  isChangesView: boolean,
  onDiscardFile: ((relativePath: string) => Promise<void>) | undefined,
  highlightedPath: string | null,
  searched: VaultEntry[],
) {
  if (!isChangesView || !onDiscardFile || !event.shiftKey || event.key !== 'F10' || !highlightedPath) return null
  return searched.find((candidate) => candidate.path === highlightedPath) ?? null
}

function openHighlightedChangesContextMenu(
  entry: VaultEntry,
  openContextMenuForEntry: (entry: VaultEntry, point: { x: number; y: number }) => void,
) {
  const row = document.querySelector<HTMLElement>(`[data-note-path="${entry.path}"]`)
  const rect = row?.getBoundingClientRect()
  openContextMenuForEntry(entry, {
    x: rect ? rect.left + 24 : 160,
    y: rect ? rect.bottom - 8 : 160,
  })
}

export function useNoteListInteractions({
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
  openContextMenuForEntry,
  onCreateNote,
}: UseNoteListInteractionsParams) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const handleKeyboardOpen = useCallback((entry: VaultEntry) => {
    if (isDeletedNoteEntry(entry)) {
      onOpenDeletedNote?.(entry)
      return
    }
    onReplaceActiveTab(entry)
  }, [onOpenDeletedNote, onReplaceActiveTab])

  const handleKeyboardPrefetch = useCallback((entry: VaultEntry) => {
    if (!isDeletedNoteEntry(entry)) prefetchNoteContent(entry.path)
  }, [])

  const noteListKeyboard = useNoteListKeyboard({
    items: searched,
    selectedNotePath,
    onOpen: handleKeyboardOpen,
    onPrefetch: handleKeyboardPrefetch,
    enabled: !isEntityView,
  })
  const multiSelect = useMultiSelect(searched, selectedNotePath)

  useEffect(() => {
    multiSelect.clear()
  }, [noteListFilter, selection]) // eslint-disable-line react-hooks/exhaustive-deps -- clear only when selection/filter changes

  const handleClickNote = useCallback((entry: VaultEntry, event: React.MouseEvent) => {
    if (isDeletedNoteEntry(entry)) {
      routeNoteClick(entry, event, {
        onReplace: () => onOpenDeletedNote?.(entry),
        onSelect: () => onOpenDeletedNote?.(entry),
        multiSelect,
      })
      return
    }

    routeNoteClick(entry, event, {
      onReplace: onReplaceActiveTab,
      onSelect: onSelectNote,
      onOpenInNewWindow,
      multiSelect,
    })

    if (isChangesView && onAutoTriggerDiff) {
      setTimeout(onAutoTriggerDiff, 50)
    }
  }, [
    isChangesView,
    multiSelect,
    onAutoTriggerDiff,
    onOpenDeletedNote,
    onOpenInNewWindow,
    onReplaceActiveTab,
    onSelectNote,
  ])

  const handleListKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const entry = resolveChangesContextMenuEntry(
      event,
      isChangesView,
      onDiscardFile,
      noteListKeyboard.highlightedPath,
      searched,
    )
    if (entry) {
      event.preventDefault()
      event.stopPropagation()
      openHighlightedChangesContextMenu(entry, openContextMenuForEntry)
      return
    }

    noteListKeyboard.handleKeyDown(event)
  }, [isChangesView, noteListKeyboard, onDiscardFile, openContextMenuForEntry, searched])

  const handleCreateNote = useCallback(() => {
    onCreateNote(selection.kind === 'sectionGroup' ? selection.type : undefined)
  }, [onCreateNote, selection])

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => toggleSetMember(prev, label))
  }, [])

  return {
    collapsedGroups,
    handleClickNote,
    handleCreateNote,
    handleListKeyDown,
    multiSelect,
    noteListKeyboard,
    toggleGroup,
  }
}
