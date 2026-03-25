import { memo, useRef, useState, useCallback, useEffect } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { usePinnedProperties, type ResolvedPinnedProperty } from '../hooks/usePinnedProperties'
import { PinnedPropertyChip } from './PinnedPropertyChip'
import { DotsThree } from '@phosphor-icons/react'

export const PinnedPropertiesBar = memo(function PinnedPropertiesBar({ entry, entries, frontmatter, onUpdateFrontmatter, onNavigate }: {
  entry: VaultEntry
  entries: VaultEntry[]
  frontmatter: ParsedFrontmatter
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onNavigate?: (target: string) => void
}) {
  const { resolved, pinnedConfigs, reorderPins } = usePinnedProperties({ entry, entries, frontmatter, onUpdateTypeFrontmatter: onUpdateFrontmatter })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pinnedConfigs.findIndex((c) => c.key === active.id)
    const newIndex = pinnedConfigs.findIndex((c) => c.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...pinnedConfigs]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderPins(reordered)
  }, [pinnedConfigs, reorderPins])

  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(resolved.length)
  const [showOverflow, setShowOverflow] = useState(false)

  const measureOverflow = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-pinchip]'))
    if (items.length === 0) { setVisibleCount(0); return }
    const containerRight = el.getBoundingClientRect().right - 48
    let count = 0
    for (const child of items) {
      if (child.getBoundingClientRect().right <= containerRight) count++
      else break
    }
    setVisibleCount(Math.max(count, 1))
  }, [])

  useEffect(() => {
    // Defer measurement to avoid synchronous setState in effect
    requestAnimationFrame(measureOverflow)
    const observer = new ResizeObserver(measureOverflow)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [measureOverflow, resolved.length])

  if (resolved.length === 0) return null

  const handleSave = (key: string, value: string) => {
    onUpdateFrontmatter?.(entry.path, key, value)
  }

  const hiddenCount = resolved.length - visibleCount

  const sortableIds = resolved.map((p) => p.key)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        <div
          ref={containerRef}
          className="flex items-start overflow-hidden"
          style={{ gap: 16, padding: '8px 0', position: 'relative' }}
          data-testid="pinned-properties-bar"
        >
          {resolved.map((p, i) => (
            <SortableChip key={p.key} prop={p} visible={i < visibleCount} onSave={handleSave} onNavigate={onNavigate} />
          ))}
          {hiddenCount > 0 && (
            <OverflowPopover
              count={hiddenCount}
              items={resolved.slice(visibleCount)}
              open={showOverflow}
              onToggle={() => setShowOverflow((v) => !v)}
              onSave={handleSave}
              onNavigate={onNavigate}
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
})

function SortableChip({ prop, visible, onSave, onNavigate }: {
  prop: ResolvedPinnedProperty; visible: boolean
  onSave: (key: string, value: string) => void; onNavigate?: (target: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prop.key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(visible ? {} : { visibility: 'hidden' as const, position: 'absolute' as const }),
  }

  return (
    <div ref={setNodeRef} data-pinchip style={style} {...attributes} {...listeners}>
      <PinnedPropertyChip
        propKey={prop.key} label={prop.label} value={prop.value} icon={prop.icon}
        isRelationship={prop.isRelationship}
        onSave={onSave} onNavigate={onNavigate}
      />
    </div>
  )
}

function OverflowPopover({ count, items, open, onToggle, onSave, onNavigate }: {
  count: number
  items: ResolvedPinnedProperty[]
  open: boolean
  onToggle: () => void
  onSave: (key: string, value: string) => void
  onNavigate?: (target: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onToggle])

  return (
    <div ref={ref} className="relative shrink-0 self-end">
      <button
        className="flex items-center gap-1 rounded border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        style={{ padding: '3px 6px', fontSize: 12 }}
        onClick={onToggle}
        title={`${count} more properties`}
      >
        <DotsThree weight="bold" width={16} height={16} />
        <span>+{count}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-wrap gap-4 rounded-lg border border-border bg-popover p-3 shadow-md" style={{ minWidth: 200, maxWidth: 400 }}>
          {items.map((p) => (
            <PinnedPropertyChip
              key={p.key} propKey={p.key} label={p.label} value={p.value} icon={p.icon}
              isRelationship={p.isRelationship}
              onSave={onSave} onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
