import { CaretUpDown } from '@phosphor-icons/react'
import { useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const CONTENT_FIELDS = new Set(['body'])

interface FilterFieldComboboxProps {
  value: string
  fields: string[]
  onChange: (value: string) => void
}

interface FieldGroup {
  key: 'property' | 'content'
  label: string
  options: string[]
}

function normalizeFieldQuery(query: string): string {
  return query.trim().toLowerCase()
}

function buildFieldGroups(fields: string[], currentValue: string, query: string): FieldGroup[] {
  const allFields = currentValue !== '' && !fields.includes(currentValue)
    ? [currentValue, ...fields]
    : fields
  const normalized = normalizeFieldQuery(query)
  const matches = (field: string) => normalized === '' || field.toLowerCase().includes(normalized)
  const propertyOptions = allFields.filter((field) => !CONTENT_FIELDS.has(field) && matches(field))
  const contentOptions = allFields.filter((field) => CONTENT_FIELDS.has(field) && matches(field))
  const groups: FieldGroup[] = []

  if (propertyOptions.length > 0) groups.push({ key: 'property', label: 'Properties', options: propertyOptions })
  if (contentOptions.length > 0) groups.push({ key: 'content', label: 'Content', options: contentOptions })

  return groups
}

function flattenGroups(groups: FieldGroup[]): string[] {
  return groups.flatMap((group) => group.options)
}

function initialHighlightIndex(options: string[], currentValue: string): number {
  if (options.length === 0) return -1
  const currentIndex = options.indexOf(currentValue)
  return currentIndex >= 0 ? currentIndex : 0
}

function optionTestId(field: string): string {
  return `filter-field-option-${field.replace(/[^a-z0-9_-]+/gi, '-')}`
}

export function FilterFieldCombobox({ value, fields, onChange }: FilterFieldComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [hasTyped, setHasTyped] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const effectiveQuery = hasTyped ? query : ''
  const fieldGroups = useMemo(() => buildFieldGroups(fields, value, effectiveQuery), [fields, value, effectiveQuery])
  const options = useMemo(() => flattenGroups(fieldGroups), [fieldGroups])

  const resetToCurrentValue = () => {
    setQuery(value)
    setHasTyped(false)
    setHighlightedIndex(initialHighlightIndex(flattenGroups(buildFieldGroups(fields, value, '')), value))
  }

  const openCombobox = () => {
    resetToCurrentValue()
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  const closeCombobox = () => {
    setOpen(false)
    resetToCurrentValue()
  }

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setQuery(nextValue)
    setHasTyped(false)
    setHighlightedIndex(-1)
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className="relative flex-1 min-w-[160px]"
      onBlur={(event) => {
        if (rootRef.current?.contains(event.relatedTarget as Node | null)) return
        closeCombobox()
      }}
      data-testid="filter-field-combobox"
    >
      <Input
        ref={inputRef}
        value={open ? query : value}
        onFocus={() => openCombobox()}
        onChange={(event) => {
          const nextQuery = event.target.value
          const nextGroups = buildFieldGroups(fields, value, nextQuery)
          const nextOptions = flattenGroups(nextGroups)
          setOpen(true)
          setQuery(nextQuery)
          setHasTyped(true)
          setHighlightedIndex(nextOptions.length > 0 ? 0 : -1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) {
              openCombobox()
              return
            }
            if (options.length === 0) return
            setHighlightedIndex((current) => {
              if (current < 0) return 0
              return (current + 1) % options.length
            })
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              openCombobox()
              return
            }
            if (options.length === 0) return
            setHighlightedIndex((current) => {
              if (current < 0) return options.length - 1
              return (current - 1 + options.length) % options.length
            })
            return
          }

          if (event.key === 'Enter') {
            if (!open || highlightedIndex < 0 || options[highlightedIndex] === undefined) return
            event.preventDefault()
            selectOption(options[highlightedIndex])
            return
          }

          if (event.key === 'Escape') {
            if (!open) return
            event.preventDefault()
            closeCombobox()
          }
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
        className="h-8 pr-7 text-sm"
        data-testid="filter-field-combobox-input"
      />
      <CaretUpDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[220px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
          data-testid="filter-field-combobox-options"
        >
          {options.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground" data-testid="filter-field-combobox-empty">
              No results
            </div>
          ) : (
            fieldGroups.map((group, groupIndex) => (
              <div key={group.key}>
                {groupIndex > 0 && <div className="my-1 border-t border-border" />}
                {group.options.map((field) => {
                  const optionIndex = options.indexOf(field)
                  return (
                    <button
                      key={field}
                      id={`${listboxId}-option-${optionIndex}`}
                      type="button"
                      role="option"
                      aria-selected={optionIndex === highlightedIndex}
                      className={cn(
                        'flex w-full items-center rounded px-2 py-1.5 text-left text-sm',
                        optionIndex === highlightedIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedIndex(optionIndex)}
                      onClick={() => selectOption(field)}
                      data-testid={optionTestId(field)}
                    >
                      <span className="truncate">{field}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
