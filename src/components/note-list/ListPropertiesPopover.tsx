import { useState, useMemo, useCallback } from 'react'
import { SlidersHorizontal, DotsSixVertical } from '@phosphor-icons/react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { VaultEntry } from '../../types'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ListPropertiesPopoverProps {
  typeDocument: VaultEntry
  entries: VaultEntry[]
  onSave: (path: string, key: string, value: string[] | null) => void
}

/** Collect all available property/relationship keys from notes of this type. */
function collectAvailableProperties(entries: VaultEntry[], typeName: string): string[] {
  const keys = new Set<string>()
  for (const entry of entries) {
    if (entry.isA !== typeName) continue
    for (const k of Object.keys(entry.properties)) keys.add(k)
    for (const k of Object.keys(entry.relationships)) keys.add(k)
  }
  // Sort alphabetically for stable ordering
  return [...keys].sort((a, b) => a.localeCompare(b))
}

function SortablePropertyItem({ id, checked, onToggle }: { id: string; checked: boolean; onToggle: (key: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted"
      data-testid={`list-prop-item-${id}`}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab items-center text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={14} />
      </button>
      <label className="flex flex-1 cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(id)}
          className="accent-primary"
          style={{ width: 14, height: 14 }}
        />
        <span className="truncate">{id}</span>
      </label>
    </div>
  )
}

export function ListPropertiesPopover({ typeDocument, entries, onSave }: ListPropertiesPopoverProps) {
  const [open, setOpen] = useState(false)
  const currentDisplay = typeDocument.listPropertiesDisplay ?? []

  const availableProperties = useMemo(
    () => collectAvailableProperties(entries, typeDocument.title),
    [entries, typeDocument.title],
  )

  // Merge: selected props first (in order), then unselected alphabetically
  const orderedItems = useMemo(() => {
    const selected = currentDisplay.filter((p) => availableProperties.includes(p))
    const unselected = availableProperties.filter((p) => !selected.includes(p))
    return [...selected, ...unselected]
  }, [currentDisplay, availableProperties])

  const selectedSet = useMemo(() => new Set(currentDisplay), [currentDisplay])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleToggle = useCallback((key: string) => {
    const newSelected = selectedSet.has(key)
      ? currentDisplay.filter((k) => k !== key)
      : [...currentDisplay, key]
    onSave(typeDocument.path, '_list_properties_display', newSelected.length > 0 ? newSelected : null)
  }, [selectedSet, currentDisplay, typeDocument.path, onSave])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Only reorder within selected items
    const selected = currentDisplay.filter((p) => availableProperties.includes(p))
    const oldIndex = selected.indexOf(String(active.id))
    const newIndex = selected.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(selected, oldIndex, newIndex)
    onSave(typeDocument.path, '_list_properties_display', reordered)
  }, [currentDisplay, availableProperties, typeDocument.path, onSave])

  if (availableProperties.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
          title="Configure list properties"
          data-testid="list-properties-btn"
        >
          <SlidersHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2" data-testid="list-properties-popover">
        <div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
          Show in note list
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedItems} strategy={verticalListSortingStrategy}>
            {orderedItems.map((key) => (
              <SortablePropertyItem
                key={key}
                id={key}
                checked={selectedSet.has(key)}
                onToggle={handleToggle}
              />
            ))}
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  )
}
