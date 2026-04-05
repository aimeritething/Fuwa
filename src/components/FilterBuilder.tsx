import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Plus, X, CalendarBlank } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FilterCondition, FilterOp, FilterGroup, FilterNode, VaultEntry } from '../types'
import { buildTypeEntryMap, getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { getTypeIcon } from './NoteItem'
import './WikilinkSuggestionMenu.css'

const OPERATORS: { value: FilterOp; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'before', label: 'before' },
  { value: 'after', label: 'after' },
]

const NO_VALUE_OPS = new Set<FilterOp>(['is_empty', 'is_not_empty'])
const DATE_OPS = new Set<FilterOp>(['before', 'after'])

function isFilterGroup(node: FilterNode): node is FilterGroup {
  return 'all' in node || 'any' in node
}

function getGroupChildren(group: FilterGroup): FilterNode[] {
  return 'all' in group ? group.all : group.any
}

function getGroupMode(group: FilterGroup): 'all' | 'any' {
  return 'all' in group ? 'all' : 'any'
}

function setGroupChildren(mode: 'all' | 'any', children: FilterNode[]): FilterGroup {
  return mode === 'all' ? { all: children } : { any: children }
}

const CONTENT_FIELDS = new Set(['body'])

function FieldSelect({ value, fields, onChange }: {
  value: string
  fields: string[]
  onChange: (v: string) => void
}) {
  const isCustom = value !== '' && !fields.includes(value)
  const propertyFields = fields.filter(f => !CONTENT_FIELDS.has(f))
  const contentFields = fields.filter(f => CONTENT_FIELDS.has(f))
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 min-w-[100px] flex-1 gap-1 border-input bg-background px-2 text-sm shadow-none"
      >
        <SelectValue placeholder="field" />
      </SelectTrigger>
      <SelectContent position="popper">
        {isCustom && <SelectItem value={value}>{value}</SelectItem>}
        {propertyFields.map((f) => (
          <SelectItem key={f} value={f}>{f}</SelectItem>
        ))}
        {contentFields.length > 0 && (
          <>
            <SelectSeparator />
            {contentFields.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  )
}

function OperatorSelect({ value, onChange }: {
  value: FilterOp
  onChange: (v: FilterOp) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as FilterOp)}>
      <SelectTrigger
        size="sm"
        className="h-8 shrink-0 gap-1 border-input bg-background px-2 text-sm shadow-none"
        style={{ minWidth: 120 }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {OPERATORS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const MAX_WIKILINK_RESULTS = 10
const MIN_WIKILINK_QUERY = 2

function entryMatchesQuery(e: VaultEntry, lowerQuery: string): boolean {
  return e.title.toLowerCase().includes(lowerQuery) ||
    e.aliases.some(a => a.toLowerCase().includes(lowerQuery))
}

function toWikilinkMatch(e: VaultEntry, typeEntryMap: Record<string, VaultEntry>) {
  const isA = e.isA
  const te = typeEntryMap[isA ?? '']
  const noteType = isA || undefined
  return {
    title: e.title,
    noteType,
    typeColor: noteType ? getTypeColor(isA, te?.color) : undefined,
    typeLightColor: noteType ? getTypeLightColor(isA, te?.color) : undefined,
    TypeIcon: noteType ? getTypeIcon(isA, te?.icon) : undefined,
  }
}

function matchWikilinkEntries(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>, query: string) {
  if (query.length < MIN_WIKILINK_QUERY) return []
  const lowerQuery = query.toLowerCase()
  return entries
    .filter(e => !e.trashed && entryMatchesQuery(e, lowerQuery))
    .slice(0, MAX_WIKILINK_RESULTS)
    .map(e => toWikilinkMatch(e, typeEntryMap))
}

type WikilinkMatch = ReturnType<typeof toWikilinkMatch>

function extractWikilinkQuery(value: string): string | null {
  return value.startsWith('[[') ? value.slice(2).replace(/]]$/, '') : null
}

function useOutsideClick(refs: React.RefObject<HTMLElement | null>[], onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (refs.every(r => !r.current?.contains(target))) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [refs, onClose])
}

function WikilinkDropdown({ matches, selectedIndex, onSelect, onHover, menuRef }: {
  matches: WikilinkMatch[]
  selectedIndex: number
  onSelect: (title: string) => void
  onHover: (index: number) => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      className="wikilink-menu"
      ref={menuRef}
      style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, zIndex: 50 }}
      data-testid="wikilink-dropdown"
    >
      {matches.map((item, index) => (
        <div
          key={item.title}
          className={`wikilink-menu__item${index === selectedIndex ? ' wikilink-menu__item--selected' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => onSelect(item.title)}
          onMouseEnter={() => onHover(index)}
        >
          <span className="wikilink-menu__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.TypeIcon && <item.TypeIcon width={14} height={14} style={{ color: item.typeColor, flexShrink: 0 }} />}
            {item.title}
          </span>
          {item.noteType && (
            <span className="wikilink-menu__type" style={{ color: item.typeColor, backgroundColor: item.typeLightColor, borderRadius: 9999, padding: '1px 8px' }}>
              {item.noteType}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function useWikilinkMatches(entries: VaultEntry[], value: string, open: boolean) {
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const wikilinkQuery = extractWikilinkQuery(value)
  return useMemo(
    () => (open && wikilinkQuery !== null) ? matchWikilinkEntries(entries, typeEntryMap, wikilinkQuery) : [],
    [entries, typeEntryMap, wikilinkQuery, open],
  )
}

function useScrollSelectedIntoView(menuRef: React.RefObject<HTMLDivElement | null>, selectedIndex: number) {
  useEffect(() => {
    if (selectedIndex < 0 || !menuRef.current) return
    const el = menuRef.current.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex, menuRef])
}

function useDropdownKeyboard(
  matches: WikilinkMatch[],
  open: boolean,
  onSelect: (title: string) => void,
  onClose: () => void,
) {
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const resetIndex = useCallback(() => setSelectedIndex(-1), [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      onSelect(matches[selectedIndex].title)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [open, matches, selectedIndex, onSelect, onClose])

  return { selectedIndex, setSelectedIndex, resetIndex, handleKeyDown }
}

function WikilinkValueInput({ value, entries, onChange }: {
  value: string
  entries: VaultEntry[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const matches = useWikilinkMatches(entries, value, open)

  const handleSelect = useCallback((title: string) => {
    onChange(`[[${title}]]`)
    setOpen(false)
  }, [onChange])

  const closeMenu = useCallback(() => setOpen(false), [])
  useOutsideClick([inputRef, menuRef], closeMenu)

  const { selectedIndex, setSelectedIndex, resetIndex, handleKeyDown } =
    useDropdownKeyboard(matches, open, handleSelect, closeMenu)

  useScrollSelectedIntoView(menuRef, selectedIndex)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setOpen(e.target.value.startsWith('[['))
    resetIndex()
  }, [onChange, resetIndex])

  return (
    <div style={{ position: 'relative' }} className="flex-1 min-w-0">
      <Input
        ref={inputRef}
        className="h-8 w-full text-sm"
        placeholder="value"
        value={value}
        onChange={handleChange}
        onFocus={() => { if (value.startsWith('[[')) setOpen(true) }}
        onKeyDown={handleKeyDown}
        data-testid="filter-value-input"
      />
      {open && matches.length > 0 && (
        <WikilinkDropdown
          matches={matches}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          onHover={setSelectedIndex}
          menuRef={menuRef}
        />
      )}
    </div>
  )
}

function DateValueInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = value ? parseISO(value) : undefined
  const selected = parsed && !isNaN(parsed.getTime()) ? parsed : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-testid="date-picker-trigger"
          className="h-8 flex-1 min-w-0 justify-start gap-2 px-2 text-sm font-normal"
        >
          <CalendarBlank size={14} className="shrink-0 text-muted-foreground" />
          {selected ? format(selected, 'MMM d, yyyy') : <span className="text-muted-foreground">Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => onChange(day ? format(day, 'yyyy-MM-dd') : '')}
        />
      </PopoverContent>
    </Popover>
  )
}

function ValueInput({ value, suggestions, isDateOp, entries, onChange }: {
  value: string
  suggestions: string[]
  isDateOp: boolean
  entries: VaultEntry[]
  onChange: (v: string) => void
}) {
  if (isDateOp) {
    return <DateValueInput value={value} onChange={onChange} />
  }

  if (suggestions.length > 0) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className="h-8 flex-1 min-w-0 gap-1 border-input bg-background px-2 text-sm shadow-none"
        >
          <SelectValue placeholder="value" />
        </SelectTrigger>
        <SelectContent position="popper">
          {value !== '' && !suggestions.includes(value) && (
            <SelectItem value={value}>{value}</SelectItem>
          )}
          {suggestions.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (entries.length > 0) {
    return <WikilinkValueInput value={value} entries={entries} onChange={onChange} />
  }

  return (
    <Input
      className="h-8 flex-1 min-w-0 text-sm"
      placeholder="value"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function FilterRow({ condition, fields, entries, valueSuggestions, onUpdate, onRemove }: {
  condition: FilterCondition
  fields: string[]
  entries: VaultEntry[]
  valueSuggestions: (field: string) => string[]
  onUpdate: (c: FilterCondition) => void
  onRemove: () => void
}) {
  const suggestions = valueSuggestions(condition.field)
  const isDateOp = DATE_OPS.has(condition.op)
  return (
    <div className="flex items-center gap-1.5">
      <FieldSelect
        value={condition.field}
        fields={fields}
        onChange={(v) => onUpdate({ ...condition, field: v })}
      />
      <OperatorSelect
        value={condition.op}
        onChange={(op) => onUpdate({ ...condition, op })}
      />
      {!NO_VALUE_OPS.has(condition.op) && (
        <ValueInput
          value={String(condition.value ?? '')}
          suggestions={suggestions}
          isDateOp={isDateOp}
          entries={entries}
          onChange={(v) => onUpdate({ ...condition, value: v })}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        onClick={onRemove}
        title="Remove filter"
      >
        <X size={14} />
      </Button>
    </div>
  )
}

function FilterGroupView({ group, fields, entries, valueSuggestions, depth, onChange, onRemove }: {
  group: FilterGroup
  fields: string[]
  entries: VaultEntry[]
  valueSuggestions: (field: string) => string[]
  depth: number
  onChange: (g: FilterGroup) => void
  onRemove?: () => void
}) {
  const mode = getGroupMode(group)
  const children = getGroupChildren(group)

  const toggleMode = () => {
    onChange(setGroupChildren(mode === 'all' ? 'any' : 'all', children))
  }

  const updateChild = (index: number, node: FilterNode) => {
    const next = [...children]
    next[index] = node
    onChange(setGroupChildren(mode, next))
  }

  const removeChild = (index: number) => {
    const next = children.filter((_, i) => i !== index)
    onChange(setGroupChildren(mode, next))
  }

  const addCondition = () => {
    onChange(setGroupChildren(mode, [...children, { field: fields[0] ?? 'type', op: 'equals' as FilterOp, value: '' }]))
  }

  const addGroup = () => {
    const nested: FilterGroup = { all: [{ field: fields[0] ?? 'type', op: 'equals' as FilterOp, value: '' }] }
    onChange(setGroupChildren(mode, [...children, nested]))
  }

  return (
    <div className={depth > 0 ? 'ml-3 border-l-2 border-border pl-3 py-1' : ''}>
      <div className="flex items-center gap-2 mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 rounded-full px-2.5 text-[11px] font-medium"
          onClick={toggleMode}
          title={`Switch to ${mode === 'all' ? 'OR' : 'AND'}`}
        >
          {mode === 'all' ? 'AND' : 'OR'}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {mode === 'all' ? 'Match all conditions' : 'Match any condition'}
        </span>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={onRemove}
            title="Remove group"
          >
            <X size={12} />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {children.map((child, i) =>
          isFilterGroup(child) ? (
            <FilterGroupView
              key={i}
              group={child}
              fields={fields}
              entries={entries}
              valueSuggestions={valueSuggestions}
              depth={depth + 1}
              onChange={(g) => updateChild(i, g)}
              onRemove={() => removeChild(i)}
            />
          ) : (
            <FilterRow
              key={i}
              condition={child}
              fields={fields}
              entries={entries}
              valueSuggestions={valueSuggestions}
              onUpdate={(c) => updateChild(i, c)}
              onRemove={() => removeChild(i)}
            />
          )
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
          <Plus size={12} className="mr-1" /> Add filter
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addGroup}>
          <Plus size={12} className="mr-1" /> Add group
        </Button>
      </div>
    </div>
  )
}

export interface FilterBuilderProps {
  group: FilterGroup
  onChange: (group: FilterGroup) => void
  availableFields: string[]
  /** Returns known values for a given field (for autocomplete). */
  valueSuggestions?: (field: string) => string[]
  /** Vault entries for wikilink autocomplete in value fields. */
  entries?: VaultEntry[]
}

const defaultSuggestions = () => [] as string[]

export function FilterBuilder({ group, onChange, availableFields, valueSuggestions, entries }: FilterBuilderProps) {
  const fields = availableFields.length > 0 ? availableFields : ['type']
  return (
    <FilterGroupView
      group={group}
      fields={fields}
      entries={entries ?? []}
      valueSuggestions={valueSuggestions ?? defaultSuggestions}
      depth={0}
      onChange={onChange}
    />
  )
}
