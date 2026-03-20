import { memo } from 'react'
import type { NoteListFilter } from '../../utils/noteListHelpers'

interface FilterPillsProps {
  active: NoteListFilter
  counts: Record<NoteListFilter, number>
  onChange: (filter: NoteListFilter) => void
}

const PILLS: { value: NoteListFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'archived', label: 'Archived' },
  { value: 'trashed', label: 'Trashed' },
]

function FilterPillsInner({ active, counts, onChange }: FilterPillsProps) {
  return (
    <div className="flex h-auto min-h-[45px] shrink-0 flex-wrap items-center gap-1 border-b border-border px-4 py-1.5" data-testid="filter-pills">
      {PILLS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={active === value}
          className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            active === value
              ? 'border-foreground/20 bg-foreground/10 text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          onClick={() => onChange(value)}
          data-testid={`filter-pill-${value}`}
        >
          {label}
          <span className={`text-[10px] tabular-nums ${active === value ? 'text-foreground/70' : 'text-muted-foreground/70'}`}>
            {counts[value]}
          </span>
        </button>
      ))}
    </div>
  )
}

export const FilterPills = memo(FilterPillsInner)
