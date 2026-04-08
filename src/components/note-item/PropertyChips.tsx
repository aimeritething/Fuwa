import { createElement, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../types'
import { findIcon } from '../../utils/iconRegistry'
import { resolveNoteIcon } from '../../utils/noteIcon'
import { getTypeColor, getTypeLightColor } from '../../utils/typeColors'
import { isUrlValue, normalizeUrl, openExternalUrl } from '../../utils/url'
import { resolveEntry, wikilinkDisplay, wikilinkTarget } from '../../utils/wikilink'

interface PropertyChipValue {
  label: string
  noteIcon: string | null
  typeIcon: string | null
  style?: CSSProperties
  action?: { kind: 'note'; entry: VaultEntry } | { kind: 'url'; url: string }
  tone: 'neutral' | 'relationship' | 'url'
}

const URL_CHIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-blue-light)',
  color: 'var(--accent-blue)',
}

function toChipTestId(propName: string, index: number): string {
  const slug = propName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `property-chip-${slug || 'value'}-${index}`
}

function normalizeOpenableUrl(value: string): string | null {
  if (!isUrlValue(value)) return null
  const normalized = normalizeUrl(value)
  try {
    const url = new URL(normalized)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatChipLabel(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const raw = String(value)
  const openableUrl = normalizeOpenableUrl(raw)
  if (openableUrl) return new URL(openableUrl).hostname
  return raw.length > 40 ? `${raw.slice(0, 37)}…` : raw
}

function resolveRelationshipChipStyle(targetEntry: VaultEntry, typeEntryMap: Record<string, VaultEntry>): CSSProperties | undefined {
  const typeEntry = targetEntry.isA ? (typeEntryMap[targetEntry.isA] ?? typeEntryMap[targetEntry.isA.toLowerCase()]) : undefined
  const color = getTypeColor(targetEntry.isA, typeEntry?.color)
  const backgroundColor = getTypeLightColor(targetEntry.isA, typeEntry?.color)
  if (color === 'var(--muted-foreground)' && backgroundColor === 'var(--muted)') return undefined
  return { color, backgroundColor }
}

function resolveRelationshipChip(
  ref: string,
  allEntries: VaultEntry[],
  typeEntryMap: Record<string, VaultEntry>,
): PropertyChipValue | null {
  const label = wikilinkDisplay(ref)
  if (!label) return null

  const targetEntry = resolveEntry(allEntries, wikilinkTarget(ref))
  if (!targetEntry) {
    return {
      label,
      noteIcon: null,
      typeIcon: null,
      tone: 'neutral',
    }
  }

  const typeEntry = targetEntry.isA ? (typeEntryMap[targetEntry.isA] ?? typeEntryMap[targetEntry.isA.toLowerCase()]) : undefined
  return {
    label,
    noteIcon: targetEntry.icon ?? null,
    typeIcon: targetEntry.isA ? typeEntry?.icon ?? null : null,
    style: resolveRelationshipChipStyle(targetEntry, typeEntryMap),
    action: { kind: 'note', entry: targetEntry },
    tone: 'relationship',
  }
}

function resolveScalarChip(value: unknown): PropertyChipValue | null {
  const label = formatChipLabel(value)
  if (!label) return null

  const openableUrl = typeof value === 'string' ? normalizeOpenableUrl(value) : null
  if (openableUrl) {
    return {
      label,
      noteIcon: null,
      typeIcon: null,
      style: URL_CHIP_STYLE,
      action: { kind: 'url', url: openableUrl },
      tone: 'url',
    }
  }

  return {
    label,
    noteIcon: null,
    typeIcon: null,
    tone: 'neutral',
  }
}

function resolvePropertyChipValues(
  entry: VaultEntry,
  propName: string,
  allEntries: VaultEntry[],
  typeEntryMap: Record<string, VaultEntry>,
): PropertyChipValue[] {
  if (propName.toLowerCase() === 'status') {
    const statusChip = resolveScalarChip(entry.status)
    return statusChip ? [statusChip] : []
  }

  const relationshipKey = Object.keys(entry.relationships).find((key) => key.toLowerCase() === propName.toLowerCase())
  if (relationshipKey) {
    return entry.relationships[relationshipKey]
      .map((ref) => resolveRelationshipChip(ref, allEntries, typeEntryMap))
      .filter((chip): chip is PropertyChipValue => chip !== null)
  }

  const propertyKey = Object.keys(entry.properties).find((key) => key.toLowerCase() === propName.toLowerCase())
  if (!propertyKey) return []

  const rawValue = entry.properties[propertyKey]
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  return values
    .map((value) => resolveScalarChip(value))
    .filter((chip): chip is PropertyChipValue => chip !== null)
}

function PropertyChipIcon({
  noteIcon,
  typeIcon,
  tone,
}: {
  noteIcon?: string | null
  typeIcon?: string | null
  tone: PropertyChipValue['tone']
}) {
  const [imageFailed, setImageFailed] = useState(false)

  if (tone === 'url') {
    return <Link aria-hidden="true" width={11} height={11} className="shrink-0" />
  }

  const resolvedNoteIcon = resolveNoteIcon(noteIcon)
  const TypeIcon = findIcon(typeIcon)

  if (resolvedNoteIcon.kind === 'emoji') {
    return (
      <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center leading-none" style={{ fontSize: 11, lineHeight: 1 }}>
        {resolvedNoteIcon.value}
      </span>
    )
  }

  if (resolvedNoteIcon.kind === 'phosphor') {
    return <resolvedNoteIcon.Icon aria-hidden="true" width={11} height={11} className="shrink-0" />
  }

  if (resolvedNoteIcon.kind === 'image' && !imageFailed) {
    return (
      <img
        src={resolvedNoteIcon.src}
        alt=""
        aria-hidden="true"
        className="h-[11px] w-[11px] shrink-0 rounded-sm object-cover"
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (!TypeIcon) return null
  return createElement(TypeIcon, { 'aria-hidden': true, width: 11, height: 11, className: 'shrink-0' })
}

async function handleChipClick(
  event: MouseEvent<HTMLSpanElement>,
  chip: PropertyChipValue,
  onOpenNote: (entry: VaultEntry, event: MouseEvent) => void,
) {
  event.preventDefault()
  event.stopPropagation()

  if (!event.metaKey || !chip.action) return

  if (chip.action.kind === 'note') {
    onOpenNote(chip.action.entry, event)
    return
  }

  await openExternalUrl(chip.action.url).catch(() => {})
}

export function PropertyChips({
  entry,
  displayProps,
  allEntries,
  typeEntryMap,
  onOpenNote,
}: {
  entry: VaultEntry
  displayProps: string[]
  allEntries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  onOpenNote: (entry: VaultEntry, event: MouseEvent) => void
}) {
  const chips = useMemo(() => {
    const result: { key: string; values: PropertyChipValue[] }[] = []
    for (const prop of displayProps) {
      const values = resolvePropertyChipValues(entry, prop, allEntries, typeEntryMap)
      if (values.length > 0) result.push({ key: prop, values })
    }
    return result
  }, [allEntries, displayProps, entry, typeEntryMap])

  if (chips.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid="property-chips">
      {chips.map(({ key, values }) =>
        values.map((chip, index) => (
          <span
            key={`${key}-${index}`}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground',
              chip.action && 'cursor-pointer',
            )}
            style={chip.style}
            onClick={(event) => { void handleChipClick(event, chip, onOpenNote) }}
            data-testid={toChipTestId(key, index)}
          >
            <PropertyChipIcon noteIcon={chip.noteIcon} typeIcon={chip.typeIcon} tone={chip.tone} />
            <span className="truncate whitespace-nowrap">{chip.label}</span>
          </span>
        ))
      )}
    </div>
  )
}
