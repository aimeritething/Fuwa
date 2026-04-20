import { useMemo } from 'react'
import type { VaultEntry } from '../../types'
import { orderInverseRelationshipLabels, resolveInverseRelationshipLabel } from '../../utils/inverseRelationshipLabels'
import { getTypeColor } from '../../utils/typeColors'
import { getTypeIcon } from '../NoteItem'
import { LinkButton } from './LinkButton'

export interface ReferencedByItem {
  entry: VaultEntry
  viaKey: string
}

export function ReferencedByPanel({ items, typeEntryMap, onNavigate }: {
  items: ReferencedByItem[]
  typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, VaultEntry>>()
    for (const item of items) {
      const label = resolveInverseRelationshipLabel(item.viaKey, item.entry)
      const entriesByPath = map.get(label) ?? new Map<string, VaultEntry>()
      entriesByPath.set(item.entry.path, item.entry)
      map.set(label, entriesByPath)
    }

    return orderInverseRelationshipLabels(map.keys()).map((label) => [
      label,
      [...(map.get(label)?.values() ?? [])],
    ] as const)
  }, [items])

  if (items.length === 0) return null

  return (
    <div className="referenced-by-panel">
      <div className="mb-2 flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
          Derived relationships
        </span>
        <span className="text-[10px] text-muted-foreground/80">
          Read-only groups sourced from other notes.
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {grouped.map(([label, groupEntries]) => (
          <div key={label}>
            <span className="mb-1 block text-muted-foreground" style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.02em', opacity: 0.7 }}>
              {label}
            </span>
            <div className="flex flex-col gap-0.5">
              {groupEntries.map((e) => {
                const te = typeEntryMap[e.isA ?? '']
                return (
                  <LinkButton
                    key={e.path}
                    label={e.title}
                    noteIcon={e.icon}
                    typeColor={getTypeColor(e.isA, te?.color)}
                    isArchived={e.archived}
                    onClick={() => onNavigate(e.title)}
                    title={e.archived ? 'Archived' : undefined}
                    TypeIcon={getTypeIcon(e.isA, te?.icon)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
