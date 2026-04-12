import { useState, useMemo, useCallback, useEffect } from 'react'
import { SlidersHorizontal, DotsSixVertical } from '@phosphor-icons/react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  OPEN_NOTE_LIST_PROPERTIES_EVENT,
  type NoteListPropertiesScope,
  type OpenListPropertiesEventDetail,
} from './noteListPropertiesEvents'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type NoteListPropertyKey = string

export interface ListPropertiesPopoverProps {
  scope: NoteListPropertiesScope
  availableProperties: NoteListPropertyKey[]
  currentDisplay: NoteListPropertyKey[]
  onSave: (value: NoteListPropertyKey[] | null) => void
  triggerTitle: string
  triggerClassName?: string
}

function propertyInputId(id: NoteListPropertyKey): string {
  return `list-prop-${id.replace(/[^a-z0-9_-]+/gi, '-')}`
}

function getSelectedProperties(currentDisplay: NoteListPropertyKey[], availableProperties: NoteListPropertyKey[]) {
  return currentDisplay.filter((property) => availableProperties.includes(property))
}

function getOrderedItems(currentDisplay: NoteListPropertyKey[], availableProperties: NoteListPropertyKey[]) {
  const selected = getSelectedProperties(currentDisplay, availableProperties)
  const unselected = availableProperties.filter((property) => !selected.includes(property))
  return [...selected, ...unselected]
}

function toggleDisplayProperty(currentDisplay: NoteListPropertyKey[], selectedSet: Set<NoteListPropertyKey>, key: NoteListPropertyKey) {
  if (selectedSet.has(key)) {
    const filtered = currentDisplay.filter((property) => property !== key)
    return filtered.length > 0 ? filtered : null
  }

  return [...currentDisplay, key]
}

function reorderDisplayProperties(event: DragEndEvent, currentDisplay: NoteListPropertyKey[], availableProperties: NoteListPropertyKey[]) {
  const { active, over } = event
  if (!over || active.id === over.id) return undefined

  const selected = getSelectedProperties(currentDisplay, availableProperties)
  const oldIndex = selected.indexOf(String(active.id) as NoteListPropertyKey)
  const newIndex = selected.indexOf(String(over.id) as NoteListPropertyKey)
  if (oldIndex === -1 || newIndex === -1) return undefined

  return arrayMove(selected, oldIndex, newIndex)
}

function SortablePropertyItem({ id, checked, onToggle }: { id: NoteListPropertyKey; checked: boolean; onToggle: (key: NoteListPropertyKey) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const inputId = propertyInputId(id)
  const dragAttributes = { ...attributes, tabIndex: -1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted"
      data-testid={`list-prop-item-${id}`}
    >
      <Checkbox
        id={inputId}
        checked={checked}
        onCheckedChange={() => onToggle(id)}
        aria-label={id}
      />
      <label
        htmlFor={inputId}
        className="flex flex-1 cursor-pointer items-center gap-2 text-[13px]"
        onClick={(event) => {
          event.preventDefault()
          onToggle(id)
        }}
      >
        <span className="truncate">{id}</span>
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label={`Reorder ${id}`}
        {...dragAttributes}
        {...listeners}
      >
        <DotsSixVertical size={14} />
      </Button>
    </div>
  )
}

export function ListPropertiesPopover({
  scope,
  availableProperties,
  currentDisplay,
  onSave,
  triggerTitle,
  triggerClassName,
}: ListPropertiesPopoverProps) {
  const [open, setOpen] = useState(false)

  const orderedItems = useMemo(
    () => getOrderedItems(currentDisplay, availableProperties),
    [availableProperties, currentDisplay],
  )

  const selectedSet = useMemo(() => new Set(currentDisplay), [currentDisplay])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenListPropertiesEventDetail>).detail
      if (detail?.scope === scope) setOpen(true)
    }
    window.addEventListener(OPEN_NOTE_LIST_PROPERTIES_EVENT, handler)
    return () => window.removeEventListener(OPEN_NOTE_LIST_PROPERTIES_EVENT, handler)
  }, [scope])

  const handleToggle = useCallback((key: string) => {
    const nextSelected = toggleDisplayProperty(currentDisplay, selectedSet, key)
    onSave(nextSelected)
  }, [currentDisplay, onSave, selectedSet])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const reordered = reorderDisplayProperties(event, currentDisplay, availableProperties)
    if (!reordered) return

    onSave(reordered)
  }, [availableProperties, currentDisplay, onSave])

  if (availableProperties.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn('h-7 w-7 text-muted-foreground', triggerClassName)}
          title={triggerTitle}
          aria-label={triggerTitle}
          data-testid="list-properties-btn"
        >
          <SlidersHorizontal size={16} />
        </Button>
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
