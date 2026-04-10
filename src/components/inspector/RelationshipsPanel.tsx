import { useMemo, useCallback, useState, useRef } from 'react'
import type { VaultEntry } from '../../types'
import { Plus, X } from '@phosphor-icons/react'
import type { ParsedFrontmatter } from '../../utils/frontmatter'
import { containsWikilinks } from '../DynamicPropertiesPanel'
import type { FrontmatterValue } from '../Inspector'
import { NoteSearchList } from '../NoteSearchList'
import { useNoteSearch } from '../../hooks/useNoteSearch'
import {
  resolveEntry,
  canonicalWikilinkTargetForEntry,
  canonicalWikilinkTargetForTitle,
  formatWikilinkRef,
} from '../../utils/wikilink'
import { isWikilink, resolveRefProps } from './shared'
import { LinkButton } from './LinkButton'

/** Check whether any entry resolves for the given title (exact match via wikilink resolution). */
function hasExactTitleMatch(entries: VaultEntry[], title: string): boolean {
  return resolveEntry(entries, title) !== undefined
}

function inferVaultPath(entries: VaultEntry[]): string {
  if (entries.length === 0) return ''
  const segments = entries.map((entry) => entry.path.split('/').slice(0, -1))
  const prefix: string[] = []
  const maxDepth = Math.min(...segments.map((parts) => parts.length))
  for (let i = 0; i < maxDepth; i += 1) {
    const segment = segments[0][i]
    if (segments.every((parts) => parts[i] === segment)) prefix.push(segment)
    else break
  }
  return prefix.join('/')
}

function canonicalRefForEntry(entry: VaultEntry, vaultPath: string): string {
  return formatWikilinkRef(canonicalWikilinkTargetForEntry(entry, vaultPath))
}

function canonicalRefForTitle(title: string, entries: VaultEntry[], vaultPath: string): string {
  return formatWikilinkRef(canonicalWikilinkTargetForTitle(title, entries, vaultPath))
}

function shouldShowSearchDropdown(focused: boolean, trimmed: string, resultCount: number, showCreate: boolean): boolean {
  return focused && trimmed.length > 0 && (resultCount > 0 || showCreate)
}

function confirmRelationshipSelection({
  showCreate,
  selectedIndex,
  createIndex,
  trimmed,
  selectedEntry,
  onCreate,
  onSelectEntry,
  onFallback,
}: {
  showCreate: boolean
  selectedIndex: number
  createIndex: number
  trimmed: string
  selectedEntry?: VaultEntry
  onCreate?: (title: string) => void
  onSelectEntry?: (entry: VaultEntry) => void
  onFallback?: () => void
}): void {
  if (showCreate && selectedIndex === createIndex && trimmed) {
    onCreate?.(trimmed)
    return
  }
  if (selectedEntry) {
    onSelectEntry?.(selectedEntry)
    return
  }
  onFallback?.()
}

/** Shared keyboard navigation for search dropdowns with an optional "create" item. */
function useSearchKeyboard(
  search: ReturnType<typeof useNoteSearch>,
  totalItems: number,
  onConfirm: () => void,
  onEscape: () => void,
) {
  return useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      search.setSelectedIndex((i: number) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      search.setSelectedIndex((i: number) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onConfirm()
    } else if (e.key === 'Escape') {
      onEscape()
    }
  }, [search, totalItems, onConfirm, onEscape])
}

/** Wraps the create-and-open-note pattern: calls the async creator, then defers a side-effect to the next tick. */
function useCreateAndOpen(
  onCreateAndOpenNote: ((title: string) => Promise<boolean>) | undefined,
  afterCreate: (title: string) => void,
  onDone: () => void,
) {
  return useCallback(async (title: string) => {
    if (!onCreateAndOpenNote || !title) return
    const ok = await onCreateAndOpenNote(title)
    if (!ok) return
    // Defer frontmatter update to next tick to avoid radix-ui
    // infinite setState loop from overlapping render batches
    setTimeout(() => afterCreate(title), 0)
    onDone()
  }, [onCreateAndOpenNote, afterCreate, onDone])
}

/** Derives create-option state from search results and entries. */
function useCreateOption(
  entries: VaultEntry[],
  trimmedQuery: string,
  resultCount: number,
  hasCreator: boolean,
) {
  const showCreate = hasCreator && trimmedQuery.length > 0 && !hasExactTitleMatch(entries, trimmedQuery)
  return { showCreate, createIndex: resultCount, totalItems: resultCount + (showCreate ? 1 : 0) }
}

function CreateAndOpenOption({ title, selected, onClick, onHover }: {
  title: string
  selected: boolean
  onClick: () => void
  onHover: () => void
}) {
  return (
    <div
      className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors ${selected ? 'bg-accent' : 'hover:bg-secondary'}`}
      data-testid="create-and-open-option"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={onHover}
    >
      <Plus size={14} className="shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">
        Create &amp; open <strong>{title}</strong>
      </span>
    </div>
  )
}

function SearchDropdownWithCreate({ search, onSelect, query, entries, onCreateAndOpen }: {
  search: ReturnType<typeof useNoteSearch>
  onSelect: (entry: VaultEntry) => void
  query: string
  entries: VaultEntry[]
  onCreateAndOpen?: (title: string) => void
}) {
  const trimmed = query.trim()
  const { showCreate, createIndex } = useCreateOption(entries, trimmed, search.results.length, !!onCreateAndOpen)
  const hasResults = search.results.length > 0

  if (!hasResults && !showCreate) return null

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border border-border bg-popover shadow-md">
      {hasResults && (
        <NoteSearchList
          items={search.results}
          selectedIndex={search.selectedIndex}
          getItemKey={(item) => item.entry.path}
          onItemClick={(item) => onSelect(item.entry)}
          onItemHover={(i) => search.setSelectedIndex(i)}
          className="max-h-[160px] overflow-y-auto"
        />
      )}
      {showCreate && onCreateAndOpen && (
        <CreateAndOpenOption
          title={trimmed}
          selected={search.selectedIndex === createIndex}
          onClick={() => onCreateAndOpen(trimmed)}
          onHover={() => search.setSelectedIndex(createIndex)}
        />
      )}
    </div>
  )
}

function useInlineAddNoteState(
  entries: VaultEntry[],
  vaultPath: string,
  onAdd: (ref: string) => void,
  onCreateAndOpenNote?: (title: string) => Promise<boolean>,
) {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useNoteSearch(entries, query, 8)

  const trimmed = query.trim()
  const { showCreate, createIndex, totalItems } = useCreateOption(entries, trimmed, search.results.length, !!onCreateAndOpenNote)

  const dismiss = useCallback(() => {
    setQuery('')
    setActive(false)
  }, [])

  const selectAndClose = useCallback((ref: string) => {
    onAdd(ref)
    dismiss()
  }, [onAdd, dismiss])

  const selectEntryAndClose = useCallback((entry: VaultEntry) => {
    selectAndClose(canonicalRefForEntry(entry, vaultPath))
  }, [selectAndClose, vaultPath])

  const handleCreateAndOpen = useCreateAndOpen(
    onCreateAndOpenNote,
    (title) => onAdd(canonicalRefForTitle(title, entries, vaultPath)),
    dismiss,
  )

  const handleFallback = useCallback(() => {
    if (!trimmed) return
    selectAndClose(canonicalRefForTitle(trimmed, entries, vaultPath))
  }, [trimmed, selectAndClose, entries, vaultPath])

  const handleConfirm = useCallback(() => {
    confirmRelationshipSelection({
      showCreate,
      selectedIndex: search.selectedIndex,
      createIndex,
      trimmed,
      selectedEntry: search.selectedEntry,
      onCreate: handleCreateAndOpen,
      onSelectEntry: selectEntryAndClose,
      onFallback: handleFallback,
    })
  }, [showCreate, search.selectedIndex, search.selectedEntry, createIndex, trimmed, handleCreateAndOpen, selectEntryAndClose, handleFallback])

  const handleKeyDown = useSearchKeyboard(search, totalItems, handleConfirm, dismiss)
  const showDropdown = shouldShowSearchDropdown(active, trimmed, search.results.length, showCreate)

  return {
    active,
    setActive,
    query,
    setQuery,
    inputRef,
    search,
    dismiss,
    handleKeyDown,
    showDropdown,
    selectEntryAndClose,
    showCreate,
    handleCreateAndOpen,
  }
}

function InlineAddNote({ entries, vaultPath, onAdd, onCreateAndOpenNote }: {
  entries: VaultEntry[]
  vaultPath: string
  onAdd: (ref: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  const {
    active,
    setActive,
    query,
    setQuery,
    inputRef,
    search,
    dismiss,
    handleKeyDown,
    showDropdown,
    selectEntryAndClose,
    handleCreateAndOpen,
  } = useInlineAddNoteState(entries, vaultPath, onAdd, onCreateAndOpenNote)

  if (!active) {
    return (
      <button
        className="mt-1 w-full border border-dashed border-border bg-transparent text-left text-muted-foreground cursor-pointer hover:border-foreground hover:text-foreground"
        style={{ borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
        onClick={() => setActive(true)}
        data-testid="add-relation-ref"
      >
        Add
      </button>
    )
  }

  return (
    <div className="relative mt-1">
      <div className="group/add relative flex items-center">
        <input
          ref={inputRef}
          autoFocus
          className="w-full border border-border bg-transparent text-foreground"
          style={{ borderRadius: 6, outline: 'none', minWidth: 0, padding: '6px 10px', fontSize: 12 }}
          placeholder="Note title"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="add-relation-ref-input"
        />
        <button
          className="absolute right-1 top-1/2 -translate-y-1/2 border-none bg-transparent p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/add:opacity-100"
          onClick={dismiss}
        >
          <X size={12} />
        </button>
      </div>
      {showDropdown && (
        <SearchDropdownWithCreate
          search={search}
          onSelect={selectEntryAndClose}
          query={query}
          entries={entries}
          onCreateAndOpen={onCreateAndOpenNote ? (title) => { handleCreateAndOpen(title) } : undefined}
        />
      )}
    </div>
  )
}

function RelationshipGroup({ label, refs, entries, typeEntryMap, vaultPath, onNavigate, onRemoveRef, onAddRef, onCreateAndOpenNote }: {
  label: string; refs: string[]; entries: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>; vaultPath: string
  onNavigate: (target: string) => void
  onRemoveRef?: (ref: string) => void
  onAddRef?: (ref: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  if (refs.length === 0) return null
  return (
    <div className="mb-2.5">
      <span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>
      <div className="flex flex-col gap-1">
        {refs.map((ref, idx) => {
          const props = resolveRefProps(ref, entries, typeEntryMap)
          return (
            <LinkButton
              key={`${ref}-${idx}`}
              {...props}
              onClick={() => onNavigate(props.target)}
              onRemove={onRemoveRef ? () => onRemoveRef(ref) : undefined}
            />
          )
        })}
      </div>
      {onAddRef && (
        <InlineAddNote
          entries={entries}
          vaultPath={vaultPath}
          onAdd={onAddRef}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )}
    </div>
  )
}

function extractRelationshipRefs(frontmatter: ParsedFrontmatter): { key: string; refs: string[] }[] {
  return Object.entries(frontmatter)
    .filter(([key, value]) => key !== 'Type' && containsWikilinks(value))
    .map(([key, value]) => {
      const refs: string[] = []
      if (typeof value === 'string' && isWikilink(value)) refs.push(value)
      else if (Array.isArray(value)) value.forEach(v => { if (typeof v === 'string' && isWikilink(v)) refs.push(v) })
      return { key, refs }
    })
    .filter(({ refs }) => refs.length > 0)
}

function NoteTargetInput({ entries, value, onChange, onSubmit, onCancel, onCreateAndOpenNote, onSubmitWithCreate }: {
  entries: VaultEntry[]
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  onCancel?: () => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  onSubmitWithCreate?: (title: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const search = useNoteSearch(entries, value, 8)

  const trimmed = value.trim()
  const { showCreate, createIndex, totalItems } = useCreateOption(entries, trimmed, search.results.length, !!onCreateAndOpenNote)

  const selectEntry = useCallback((entry: VaultEntry) => {
    onChange(entry.title)
    setFocused(false)
  }, [onChange])

  const handleConfirm = useCallback(() => {
    confirmRelationshipSelection({
      showCreate,
      selectedIndex: search.selectedIndex,
      createIndex,
      trimmed,
      selectedEntry: search.selectedEntry,
      onCreate: onSubmitWithCreate,
      onSelectEntry: selectEntry,
      onFallback: onSubmit,
    })
  }, [showCreate, search.selectedIndex, search.selectedEntry, createIndex, trimmed, onSubmitWithCreate, selectEntry, onSubmit])

  const handleEscape = useCallback(() => {
    onCancel?.()
  }, [onCancel])

  const handleKeyDown = useSearchKeyboard(search, totalItems, handleConfirm, handleEscape)
  const showDropdown = shouldShowSearchDropdown(focused, trimmed, search.results.length, showCreate)

  return (
    <div className="relative">
      <input
        className="w-full border border-border bg-transparent px-2 py-1 text-xs text-foreground"
        style={{ borderRadius: 4, outline: 'none' }}
        placeholder="Note title"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <SearchDropdownWithCreate
          search={search}
          onSelect={selectEntry}
          query={value}
          entries={entries}
          onCreateAndOpen={onCreateAndOpenNote ? (title) => onSubmitWithCreate?.(title) : undefined}
        />
      )}
    </div>
  )
}

function useRelationshipPanelState(
  frontmatter: ParsedFrontmatter,
  entries: VaultEntry[],
  vaultPath: string | undefined,
  onAddProperty?: (key: string, value: FrontmatterValue) => void,
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void,
  onDeleteProperty?: (key: string) => void,
) {
  const relationshipEntries = useMemo(() => extractRelationshipRefs(frontmatter), [frontmatter])
  const resolvedVaultPath = useMemo(() => vaultPath ?? inferVaultPath(entries), [vaultPath, entries])

  const handleRemoveRef = useCallback((key: string, refToRemove: string) => {
    if (!onUpdateProperty || !onDeleteProperty) return
    const group = relationshipEntries.find(g => g.key === key)
    if (!group) return
    const result = updateRefsForRemoval(group.refs, refToRemove)
    if (result === null) onDeleteProperty(key)
    else onUpdateProperty(key, result)
  }, [relationshipEntries, onUpdateProperty, onDeleteProperty])

  const handleAddRef = useCallback((key: string, ref: string) => {
    if (!onUpdateProperty) return
    const existing = relationshipEntries.find(g => g.key === key)?.refs ?? []
    const result = updateRefsForAddition(existing, ref)
    if (result !== false) onUpdateProperty(key, result)
  }, [relationshipEntries, onUpdateProperty])

  const canEdit = !!onUpdateProperty && !!onDeleteProperty
  const existingRelKeys = useMemo(
    () => new Set(relationshipEntries.map(g => g.key.toLowerCase())),
    [relationshipEntries],
  )
  const missingSuggestedRels = useMemo(
    () => (onAddProperty ? SUGGESTED_RELATIONSHIPS.filter(r => !existingRelKeys.has(r.toLowerCase())) : []),
    [onAddProperty, existingRelKeys],
  )

  return {
    relationshipEntries,
    resolvedVaultPath,
    handleRemoveRef,
    handleAddRef,
    canEdit,
    missingSuggestedRels,
  }
}

function AddRelationshipForm({ entries, vaultPath, onAddProperty, onCreateAndOpenNote }: {
  entries: VaultEntry[]
  vaultPath: string
  onAddProperty: (key: string, value: FrontmatterValue) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  const [relKey, setRelKey] = useState('')
  const [relTarget, setRelTarget] = useState('')
  const [showForm, setShowForm] = useState(false)
  const keyInputRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setShowForm(false); setRelKey(''); setRelTarget('')
  }, [])

  const submitForm = useCallback((targetOverride?: string) => {
    const key = relKey.trim()
    const rawTarget = (targetOverride ?? relTarget).trim()
    if (!key || !rawTarget) return
    onAddProperty(key, canonicalRefForTitle(rawTarget, entries, vaultPath))
    resetForm()
  }, [relKey, relTarget, entries, vaultPath, onAddProperty, resetForm])

  const addPropertyForKey = useCallback((title: string) => {
    const key = relKey.trim()
    if (key) onAddProperty(key, canonicalRefForTitle(title, entries, vaultPath))
  }, [relKey, entries, vaultPath, onAddProperty])

  const handleCreateAndSubmit = useCreateAndOpen(onCreateAndOpenNote, addPropertyForKey, resetForm)

  if (!showForm) {
    return (
      <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }} onClick={() => { setShowForm(true); setTimeout(() => keyInputRef.current?.focus(), 0) }}>+ Add relationship</button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <input
        ref={keyInputRef}
        autoFocus
        className="w-full border border-border bg-transparent px-2 py-1 text-xs text-foreground"
        style={{ borderRadius: 4, outline: 'none' }}
        placeholder="Relationship name"
        value={relKey}
        onChange={e => setRelKey(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submitForm(); else if (e.key === 'Escape') resetForm() }}
      />
      <NoteTargetInput
        entries={entries}
        value={relTarget}
        onChange={setRelTarget}
        onSubmit={submitForm}
        onCancel={resetForm}
        onCreateAndOpenNote={onCreateAndOpenNote}
        onSubmitWithCreate={handleCreateAndSubmit}
      />
      <div className="flex gap-1.5">
        <button className="flex-1 border border-border bg-transparent text-xs text-foreground" style={{ borderRadius: 4, padding: '4px 0' }} onClick={() => submitForm()} disabled={!relKey.trim() || !relTarget.trim()} data-testid="submit-add-relationship">Add</button>
        <button className="border border-border bg-transparent text-xs text-muted-foreground" style={{ borderRadius: 4, padding: '4px 8px' }} onClick={resetForm}>Cancel</button>
      </div>
    </div>
  )
}

function updateRefsForRemoval(refs: string[], refToRemove: string): FrontmatterValue | null {
  const remaining = refs.filter(r => r !== refToRemove)
  if (remaining.length === 0) return null
  return remaining.length === 1 ? remaining[0] : remaining
}

function updateRefsForAddition(refs: string[], refToAdd: string): FrontmatterValue | false {
  if (refs.includes(refToAdd)) return false
  const updated = [...refs, refToAdd]
  return updated.length === 1 ? updated[0] : updated
}

function DisabledLinkButton() {
  return (
    <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, opacity: 0.5, cursor: 'not-allowed' }} disabled>+ Add relationship</button>
  )
}

const SUGGESTED_RELATIONSHIPS = ['Belongs to', 'Related to', 'Has'] as const

function SuggestedRelationshipSlot({ label, entries, vaultPath, onAdd, onCreateAndOpenNote }: {
  label: string
  entries: VaultEntry[]
  vaultPath: string
  onAdd: (ref: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  return (
    <div className="mb-2.5" data-testid="suggested-relationship">
      <span className="mb-1 block text-[12px] text-muted-foreground/50">{label}</span>
      <InlineAddNote
        entries={entries}
        vaultPath={vaultPath}
        onAdd={onAdd}
        onCreateAndOpenNote={onCreateAndOpenNote}
      />
    </div>
  )
}

export function DynamicRelationshipsPanel({ frontmatter, entries, typeEntryMap, vaultPath, onNavigate, onAddProperty, onUpdateProperty, onDeleteProperty, onCreateAndOpenNote }: {
  frontmatter: ParsedFrontmatter; entries: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>; vaultPath?: string
  onNavigate: (target: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  const {
    relationshipEntries,
    resolvedVaultPath,
    handleRemoveRef,
    handleAddRef,
    canEdit,
    missingSuggestedRels,
  } = useRelationshipPanelState(frontmatter, entries, vaultPath, onAddProperty, onUpdateProperty, onDeleteProperty)

  return (
    <div>
      {relationshipEntries.map(({ key, refs }) => (
        <RelationshipGroup
          key={key} label={key} refs={refs} entries={entries} typeEntryMap={typeEntryMap} vaultPath={resolvedVaultPath} onNavigate={onNavigate}
          onRemoveRef={canEdit ? (ref) => handleRemoveRef(key, ref) : undefined}
          onAddRef={canEdit ? (ref) => handleAddRef(key, ref) : undefined}
          onCreateAndOpenNote={canEdit ? onCreateAndOpenNote : undefined}
        />
      ))}
      {missingSuggestedRels.map(label => (
        <SuggestedRelationshipSlot
          key={label}
          label={label}
          entries={entries}
          vaultPath={resolvedVaultPath}
          onAdd={(ref) => onAddProperty!(label, ref)}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      ))}
      {onAddProperty
        ? <AddRelationshipForm entries={entries} vaultPath={resolvedVaultPath} onAddProperty={onAddProperty} onCreateAndOpenNote={onCreateAndOpenNote} />
        : <DisabledLinkButton />
      }
    </div>
  )
}
