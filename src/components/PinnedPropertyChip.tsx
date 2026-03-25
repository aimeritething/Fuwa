import { useState, useRef, useCallback, useEffect } from 'react'
import type { FrontmatterValue } from './Inspector'
import { resolveIcon } from '../utils/iconRegistry'
import { getStatusStyle, DEFAULT_STATUS_STYLE } from '../utils/statusStyles'
import { wikilinkDisplay } from '../utils/wikilink'

function formatChipDisplay(value: FrontmatterValue, isRelationship: boolean): string | null {
  if (value == null) return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (isRelationship) return wikilinkDisplay(value)
    return value || null
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    const displays = value.map((v) => (typeof v === 'string' && isRelationship ? wikilinkDisplay(v) : String(v)))
    if (displays.length <= 2) return displays.join(', ')
    return `${displays[0]}, +${displays.length - 1}`
  }
  return null
}

interface ChipStyle { bg: string; color: string }

function resolveChipStyle(value: FrontmatterValue, isRelationship: boolean): ChipStyle {
  if (!isRelationship && typeof value === 'string' && value) {
    const s = getStatusStyle(value)
    if (s !== DEFAULT_STATUS_STYLE) return { bg: s.bg, color: s.color }
  }
  if (isRelationship) return { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }
  return { bg: 'var(--muted)', color: 'var(--muted-foreground)' }
}

function PropertyLabelIcon({ name }: { name: string }) {
  const IconCmp = resolveIcon(name)
  // eslint-disable-next-line react-hooks/static-components -- icon from static registry, no internal state
  return <IconCmp width={12} height={12} />
}

function PropertyLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: 12 }}>
      <PropertyLabelIcon name={icon} />
      <span>{label}</span>
    </span>
  )
}

/** Full chip for the editor pinned properties bar (icon + label above, value chip below). */
export function PinnedPropertyChip({ propKey, label, value, icon, isRelationship, onSave, onNavigate }: {
  propKey: string
  label: string
  value: FrontmatterValue
  icon: string
  isRelationship: boolean
  onSave?: (key: string, value: string) => void
  onNavigate?: (target: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const display = formatChipDisplay(value, isRelationship)
  const chipColors = resolveChipStyle(value, isRelationship)

  const startEdit = useCallback(() => {
    if (isRelationship) return
    setDraft(display ?? '')
    setEditing(true)
  }, [display, isRelationship])

  const commitEdit = useCallback(() => {
    setEditing(false)
    if (onSave && draft !== (display ?? '')) onSave(propKey, draft)
  }, [onSave, propKey, draft, display])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
  }, [commitEdit])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleChipClick = useCallback(() => {
    if (isRelationship && typeof value === 'string') {
      onNavigate?.(wikilinkDisplay(value))
    } else {
      startEdit()
    }
  }, [isRelationship, value, onNavigate, startEdit])

  return (
    <div className="flex flex-col gap-1 shrink-0" data-testid="pinned-property">
      <PropertyLabel icon={icon} label={label} />
      {editing ? (
        <input
          ref={inputRef}
          className="rounded border border-border bg-background px-2 text-foreground outline-none focus:ring-1 focus:ring-primary"
          style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', minWidth: 60, maxWidth: 160 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          className="inline-flex items-center gap-1 rounded border-none cursor-pointer transition-opacity hover:opacity-80"
          style={{ padding: '3px 8px', fontSize: 12, fontWeight: 500, backgroundColor: chipColors.bg, color: chipColors.color }}
          onClick={handleChipClick}
          title={typeof value === 'string' ? value : undefined}
        >
          {display ?? <span className="text-muted-foreground italic">&mdash;</span>}
        </button>
      )}
    </div>
  )
}
