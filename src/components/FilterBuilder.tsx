import { Plus, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FilterCondition, FilterOp } from '../types'

const OPERATORS: { value: FilterOp; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

const NO_VALUE_OPS = new Set<FilterOp>(['is_empty', 'is_not_empty'])

interface FilterBuilderProps {
  conditions: FilterCondition[]
  onChange: (conditions: FilterCondition[]) => void
  availableFields: string[]
}

function FilterRow({ condition, fields, onUpdate, onRemove }: {
  condition: FilterCondition
  fields: string[]
  onUpdate: (c: FilterCondition) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-0"
        value={condition.field}
        onChange={(e) => onUpdate({ ...condition, field: e.target.value })}
      >
        {fields.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-0"
        value={condition.op}
        onChange={(e) => onUpdate({ ...condition, op: e.target.value as FilterOp })}
      >
        {OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {!NO_VALUE_OPS.has(condition.op) && (
        <Input
          className="h-8 flex-1 min-w-0"
          placeholder="value"
          value={String(condition.value ?? '')}
          onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
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

export function FilterBuilder({ conditions, onChange, availableFields }: FilterBuilderProps) {
  const fields = availableFields.length > 0 ? availableFields : ['type']

  const handleUpdate = (index: number, updated: FilterCondition) => {
    const next = [...conditions]
    next[index] = updated
    onChange(next)
  }

  const handleRemove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    onChange([...conditions, { field: fields[0], op: 'equals', value: '' }])
  }

  return (
    <div className="space-y-2">
      {conditions.length > 1 && (
        <span className="text-[11px] font-medium text-muted-foreground">Match all of:</span>
      )}
      {conditions.map((c, i) => (
        <FilterRow
          key={i}
          condition={c}
          fields={fields}
          onUpdate={(updated) => handleUpdate(i, updated)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAdd}>
        <Plus size={12} className="mr-1" /> Add filter
      </Button>
    </div>
  )
}
