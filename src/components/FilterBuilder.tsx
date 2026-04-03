import { useId } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { FilterCondition, FilterOp, FilterGroup, FilterNode } from '../types'

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

/** Combobox-style field input with datalist autocomplete. */
function FieldInput({ value, fields, onChange }: {
  value: string
  fields: string[]
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <>
      <input
        list={id}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="field"
      />
      <datalist id={id}>
        {fields.map((f) => <option key={f} value={f} />)}
      </datalist>
    </>
  )
}

/** Combobox-style value input with autocomplete for known values. */
function ValueInput({ value, suggestions, onChange }: {
  value: string
  suggestions: string[]
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <>
      <input
        list={id}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-0"
        placeholder="value"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={id}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  )
}

function FilterRow({ condition, fields, valueSuggestions, onUpdate, onRemove }: {
  condition: FilterCondition
  fields: string[]
  valueSuggestions: (field: string) => string[]
  onUpdate: (c: FilterCondition) => void
  onRemove: () => void
}) {
  const suggestions = valueSuggestions(condition.field)
  return (
    <div className="flex items-center gap-1.5">
      <FieldInput
        value={condition.field}
        fields={fields}
        onChange={(v) => onUpdate({ ...condition, field: v })}
      />
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm shrink-0"
        value={condition.op}
        onChange={(e) => onUpdate({ ...condition, op: e.target.value as FilterOp })}
      >
        {OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {!NO_VALUE_OPS.has(condition.op) && (
        <ValueInput
          value={String(condition.value ?? '')}
          suggestions={suggestions}
          onChange={(v) => onUpdate({ ...condition, value: v })}
        />
      )}
      <button
        type="button"
        className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        onClick={onRemove}
        title="Remove filter"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function FilterGroupView({ group, fields, valueSuggestions, depth, onChange, onRemove }: {
  group: FilterGroup
  fields: string[]
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
        <button
          type="button"
          className="rounded-full border border-input bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground cursor-pointer hover:bg-accent transition-colors"
          onClick={toggleMode}
          title={`Switch to ${mode === 'all' ? 'OR' : 'AND'}`}
        >
          {mode === 'all' ? 'AND' : 'OR'}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {mode === 'all' ? 'Match all conditions' : 'Match any condition'}
        </span>
        {onRemove && (
          <button
            type="button"
            className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={onRemove}
            title="Remove group"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {children.map((child, i) =>
          isFilterGroup(child) ? (
            <FilterGroupView
              key={i}
              group={child}
              fields={fields}
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
}

const defaultSuggestions = () => [] as string[]

export function FilterBuilder({ group, onChange, availableFields, valueSuggestions }: FilterBuilderProps) {
  const fields = availableFields.length > 0 ? availableFields : ['type']
  return (
    <FilterGroupView
      group={group}
      fields={fields}
      valueSuggestions={valueSuggestions ?? defaultSuggestions}
      depth={0}
      onChange={onChange}
    />
  )
}
