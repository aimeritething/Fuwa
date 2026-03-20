import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus } from '../../types'
import {
  type SortOption, type SortDirection, type SortConfig, type NoteListFilter,
  getSortComparator, extractSortableProperties,
  buildRelationshipGroups, filterEntries, filterInboxEntries,
  loadSortPreferences, saveSortPreferences,
  parseSortConfig, serializeSortConfig, clearListSortFromLocalStorage,
} from '../../utils/noteListHelpers'
import type { InboxPeriod } from '../../types'
import { buildTypeEntryMap } from '../../utils/typeColors'
import { filterByQuery, filterGroupsByQuery, countExpiredTrash, createNoteStatusResolver, isModifiedEntry } from './noteListUtils'
import type { MultiSelectState } from '../../hooks/useMultiSelect'

// --- useTypeEntryMap ---

export function useTypeEntryMap(entries: VaultEntry[]) {
  return useMemo(() => buildTypeEntryMap(entries), [entries])
}

// --- useFilteredEntries ---

export function useFilteredEntries(entries: VaultEntry[], selection: SidebarSelection, modifiedPathSet: Set<string>, modifiedSuffixes: string[], subFilter?: NoteListFilter, inboxPeriod?: InboxPeriod) {
  const isEntityView = selection.kind === 'entity'
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const isInboxView = selection.kind === 'filter' && selection.filter === 'inbox'
  return useMemo(() => {
    if (isEntityView) return []
    if (isChangesView) return entries.filter((e) => isModifiedEntry(e.path, modifiedPathSet, modifiedSuffixes))
    if (isInboxView) return filterInboxEntries(entries, inboxPeriod ?? 'month')
    return filterEntries(entries, selection, subFilter)
  }, [entries, selection, isEntityView, isChangesView, isInboxView, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod])
}

// --- useNoteListData ---

interface NoteListDataParams {
  entries: VaultEntry[]; selection: SidebarSelection
  query: string; listSort: SortOption; listDirection: SortDirection
  modifiedPathSet: Set<string>; modifiedSuffixes: string[]
  subFilter?: NoteListFilter
  inboxPeriod?: InboxPeriod
}

export function useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod }: NoteListDataParams) {
  const isEntityView = selection.kind === 'entity'
  const isTrashView = (selection.kind === 'filter' && selection.filter === 'trash') || subFilter === 'trashed'
  const isArchivedView = (selection.kind === 'filter' && selection.filter === 'archived') || subFilter === 'archived'

  const filteredEntries = useFilteredEntries(entries, selection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod)

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

  const expiredTrashCount = useMemo(
    () => isTrashView ? countExpiredTrash(searched) : 0,
    [isTrashView, searched],
  )

  return { isEntityView, isTrashView, isArchivedView, searched, searchedGroups, expiredTrashCount }
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
    if (groupLabel === '__list__' && typeDocument && persistence) {
      persistSortToType(typeDocument.path, { option, direction }, persistence)
    } else {
      saveGroupSort(groupLabel, option, direction, setSortPrefs)
    }
  }, [typeDocument, persistence])

  const filteredEntries = useFilteredEntries(entries, selection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod)
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

function handleBulkActionKey(e: KeyboardEvent, multiSelect: MultiSelectState, onArchive: () => void, onTrash: () => void) {
  if (!multiSelect.isMultiSelecting || !(e.metaKey || e.ctrlKey)) return
  if (e.key === 'e') { e.preventDefault(); e.stopPropagation(); onArchive() }
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); onTrash() }
}

export function useMultiSelectKeyboard(multiSelect: MultiSelectState, isEntityView: boolean, onBulkArchive: () => void, onBulkTrash: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      handleEscapeKey(e, multiSelect)
      handleSelectAllKey(e, multiSelect, isEntityView)
      handleBulkActionKey(e, multiSelect, onBulkArchive, onBulkTrash)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [multiSelect, isEntityView, onBulkArchive, onBulkTrash])
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
