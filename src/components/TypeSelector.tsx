import { CaretUpDown, Check } from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { FrontmatterValue } from './Inspector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { getTypeIcon } from './NoteItem'
import { PROPERTY_CHIP_STYLE } from './propertyChipStyles'
import { PROPERTY_PANEL_ROW_STYLE } from './propertyPanelLayout'

const TYPE_NONE = '__none__'
const MIN_POPOVER_WIDTH = 220
const OPEN_COMBOBOX_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' '])

interface TypeSelectorItemProps {
  type: string
  typeColorKeys: Record<string, string | null>
  typeIconKeys: Record<string, string | null>
}

function normalizeTypeQuery({ query }: { query: string }): string {
  return query.trim().toLowerCase()
}

function buildTypeOptions({
  availableTypes,
  currentType,
  query,
}: {
  availableTypes: string[]
  currentType: string | null | undefined
  query: string
}) {
  const normalized = normalizeTypeQuery({ query })
  const types = currentType && !availableTypes.includes(currentType)
    ? [...availableTypes, currentType]
    : [...availableTypes]
  const sortedTypes = types.sort((left, right) => left.localeCompare(right))
  const filteredTypes = sortedTypes.filter((type) => normalized === '' || type.toLowerCase().includes(normalized))

  if (normalized !== '') return filteredTypes
  return [TYPE_NONE, ...filteredTypes]
}

function initialHighlightedIndex({ options, currentValue }: { options: string[]; currentValue: string }): number {
  if (options.length === 0) return -1
  const currentIndex = options.indexOf(currentValue)
  return currentIndex >= 0 ? currentIndex : 0
}

function stepHighlightedIndex(current: number, optionsLength: number, direction: 'next' | 'previous') {
  if (optionsLength === 0) return -1
  if (current < 0) return direction === 'next' ? 0 : optionsLength - 1
  return direction === 'next'
    ? (current + 1) % optionsLength
    : (current - 1 + optionsLength) % optionsLength
}

function shouldOpenCombobox(event: KeyboardEvent<HTMLButtonElement>) {
  return OPEN_COMBOBOX_KEYS.has(event.key)
}

function TypeSelectorItem({ type, typeColorKeys, typeIconKeys }: TypeSelectorItemProps) {
  const Icon = getTypeIcon(type, typeIconKeys[type])
  const color = getTypeColor(type, typeColorKeys[type])
  return (
    <>
      {/* eslint-disable-next-line react-hooks/static-components -- icon from static map lookup */}
      <Icon width={14} height={14} style={{ color }} />
      {type}
    </>
  )
}

function TypeSelectorValue({
  isA,
  typeColorKeys,
  typeIconKeys,
}: {
  isA?: string | null
  typeColorKeys: Record<string, string | null>
  typeIconKeys: Record<string, string | null>
}) {
  if (!isA) return <span className="truncate text-muted-foreground">None</span>

  return (
    <span className="flex min-w-0 items-center gap-1">
      <TypeSelectorItem type={isA} typeColorKeys={typeColorKeys} typeIconKeys={typeIconKeys} />
    </span>
  )
}

function ReadOnlyType({ isA, customColorKey, onNavigate }: { isA?: string | null; customColorKey?: string | null; onNavigate?: (target: string) => void }) {
  if (!isA) return null
  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 px-1.5" style={PROPERTY_PANEL_ROW_STYLE}>
      <span className="text-[12px] shrink-0 text-muted-foreground">Type</span>
      <div className="min-w-0">
        {onNavigate ? (
          <button
            className="min-w-0 max-w-full truncate border-none cursor-pointer ring-inset hover:ring-1 hover:ring-current"
            style={{
              ...PROPERTY_CHIP_STYLE,
              background: getTypeLightColor(isA, customColorKey),
              color: getTypeColor(isA, customColorKey),
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onClick={() => onNavigate(isA.toLowerCase())} title={isA}
          >{isA}</button>
        ) : (
          <span className="text-[12px] text-secondary-foreground">{isA}</span>
        )}
      </div>
    </div>
  )
}

interface TypeSelectorProps {
  isA?: string | null
  customColorKey?: string | null
  availableTypes: string[]
  typeColorKeys: Record<string, string | null>
  typeIconKeys: Record<string, string | null>
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onNavigate?: (target: string) => void
}

export function TypeSelector({ onUpdateProperty, ...props }: TypeSelectorProps) {
  if (!onUpdateProperty) return <ReadOnlyType isA={props.isA} customColorKey={props.customColorKey} onNavigate={props.onNavigate} />

  return <EditableTypeSelector {...props} onUpdateProperty={onUpdateProperty} />
}

function EditableTypeSelector({ isA, customColorKey, availableTypes, typeColorKeys, typeIconKeys, onUpdateProperty }: Omit<TypeSelectorProps, 'onUpdateProperty'> & {
  onUpdateProperty: (key: string, value: FrontmatterValue) => void
}) {
  const currentValue = isA ?? TYPE_NONE
  const typeColor = isA ? getTypeColor(isA, typeColorKeys[isA] ?? customColorKey) : undefined
  const typeLightColor = isA ? getTypeLightColor(isA, typeColorKeys[isA] ?? customColorKey) : undefined
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [contentWidth, setContentWidth] = useState(MIN_POPOVER_WIDTH)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const options = useMemo(
    () => buildTypeOptions({ availableTypes, currentType: isA, query }),
    [availableTypes, isA, query],
  )

  useEffect(() => {
    if (!open) return

    const updateWidth = () => {
      const nextWidth = rootRef.current?.getBoundingClientRect().width ?? MIN_POPOVER_WIDTH
      setContentWidth(Math.max(nextWidth, MIN_POPOVER_WIDTH))
    }

    updateWidth()
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    window.addEventListener('resize', updateWidth)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateWidth)
    }
  }, [open])

  const openCombobox = () => {
    const nextOptions = buildTypeOptions({ availableTypes, currentType: isA, query: '' })
    setQuery('')
    setHighlightedIndex(initialHighlightedIndex({ options: nextOptions, currentValue }))
    setOpen(true)
  }

  const closeCombobox = () => {
    setOpen(false)
    setQuery('')
    setHighlightedIndex(-1)
  }

  const selectType = (value: string) => {
    onUpdateProperty('type', value === TYPE_NONE ? null : value)
    closeCombobox()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openCombobox()
      return
    }
    closeCombobox()
  }

  const scrollHighlightedOptionIntoView = (index: number) => {
    if (index < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  const moveHighlight = (direction: 'next' | 'previous') => {
    setHighlightedIndex((current) => {
      const nextIndex = stepHighlightedIndex(current, options.length, direction)
      scrollHighlightedOptionIntoView(nextIndex)
      return nextIndex
    })
  }

  const handleTriggerPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    openCombobox()
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!shouldOpenCombobox(event)) return
    event.preventDefault()
    openCombobox()
  }

  const handleSearchChange = (query: string) => {
    const nextOptions = buildTypeOptions({ availableTypes, currentType: isA, query })
    setQuery(query)
    setHighlightedIndex(nextOptions.length > 0 ? 0 : -1)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveHighlight('next')
        return
      case 'ArrowUp':
        event.preventDefault()
        moveHighlight('previous')
        return
      case 'Enter':
        if (highlightedIndex < 0 || options[highlightedIndex] === undefined) return
        event.preventDefault()
        selectType(options[highlightedIndex])
        return
      case 'Escape':
        event.preventDefault()
        closeCombobox()
        return
      default:
        return
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 px-1.5" style={PROPERTY_PANEL_ROW_STYLE} data-testid="type-selector">
      <span className="text-[12px] shrink-0 text-muted-foreground">Type</span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <div ref={rootRef} className="min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="combobox"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-haspopup="listbox"
              className={cn(
                'h-auto max-w-full justify-between gap-1 border-none px-2 shadow-none ring-inset [&_svg]:text-current',
                isA ? 'hover:ring-1 hover:ring-current' : 'bg-muted hover:bg-muted/80',
              )}
              style={{
                ...PROPERTY_CHIP_STYLE,
                background: typeLightColor ?? undefined,
                color: typeColor ?? undefined,
              }}
              onPointerDown={handleTriggerPointerDown}
              onKeyDown={handleTriggerKeyDown}
            >
              <span className="flex min-w-0 items-center gap-1 truncate">
                <TypeSelectorValue isA={isA} typeColorKeys={typeColorKeys} typeIconKeys={typeIconKeys} />
              </span>
              <CaretUpDown size={14} aria-hidden="true" />
            </Button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          side="left"
          sideOffset={4}
          className="overflow-hidden p-1"
          style={{ width: contentWidth }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="border-b border-border p-1">
            <Input
              ref={inputRef}
              value={query}
              placeholder="Search types..."
              autoComplete="off"
              aria-label="Search types"
              className="h-8 text-sm"
              data-testid="type-selector-search-input"
              onChange={(event) => handleSearchChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No matching types
              </div>
            ) : (
              <div id={listboxId} role="listbox">
                {options.map((type, index) => {
                  const selected = type === currentValue
                  const highlighted = index === highlightedIndex
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant="ghost"
                      size="sm"
                      role="option"
                      aria-selected={selected}
                      data-index={index}
                      className={cn(
                        'h-auto w-full justify-between px-2 py-1.5 text-left font-normal',
                        highlighted && 'bg-muted',
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => selectType(type)}
                    >
                      {type === TYPE_NONE ? (
                        <span className="truncate text-muted-foreground">None</span>
                      ) : (
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          <TypeSelectorItem type={type} typeColorKeys={typeColorKeys} typeIconKeys={typeIconKeys} />
                        </span>
                      )}
                      {selected ? <Check size={14} aria-hidden="true" /> : null}
                    </Button>
                  )
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
