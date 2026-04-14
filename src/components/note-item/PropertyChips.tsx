import { createElement, useMemo, useState, type ComponentType, type CSSProperties, type MouseEvent, type ReactNode, type SVGAttributes } from 'react'
import { Link } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../types'
import { resolveNoteIcon } from '../../utils/noteIcon'
import { detectPropertyType } from '../../utils/propertyTypes'
import { getMappedStatusStyle } from '../../utils/statusStyles'
import { getTypeColor, getTypeLightColor } from '../../utils/typeColors'
import { isUrlValue, normalizeUrl, openExternalUrl } from '../../utils/url'
import { resolveEntry, wikilinkDisplay, wikilinkTarget } from '../../utils/wikilink'
import { getTypeIcon } from './typeIcon'

interface PropertyChipValue {
  label: string
  noteIcon: string | null
  typeIcon: ComponentType<SVGAttributes<SVGSVGElement>> | null
  style?: CSSProperties
  action?: { kind: 'note'; entry: VaultEntry } | { kind: 'url'; url: string }
  tone: 'neutral' | 'relationship' | 'status' | 'url'
}

const URL_CHIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-blue-light)',
  color: 'var(--accent-blue)',
}

type ChipScalarValue = string | number | boolean | null

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

function resolveTargetTypeEntry(targetEntry: VaultEntry, typeEntryMap: Record<string, VaultEntry>): VaultEntry | undefined {
  return targetEntry.isA ? (typeEntryMap[targetEntry.isA] ?? typeEntryMap[targetEntry.isA.toLowerCase()]) : undefined
}

function findMatchingKey(values: Record<string, unknown>, propName: string): string | undefined {
  return Object.keys(values).find((key) => key.toLowerCase() === propName.toLowerCase())
}

function resolveRelationshipChipStyle(targetEntry: VaultEntry, typeEntryMap: Record<string, VaultEntry>): CSSProperties | undefined {
  const typeEntry = resolveTargetTypeEntry(targetEntry, typeEntryMap)
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
  const targetEntry = resolveEntry(allEntries, wikilinkTarget(ref))
  const displayLabel = wikilinkDisplay(ref)
  const label = ref.includes('|') ? displayLabel : (targetEntry?.title ?? displayLabel)
  if (!label) return null
  if (!targetEntry) {
    return {
      label,
      noteIcon: null,
      typeIcon: null,
      tone: 'neutral',
    }
  }

  const typeEntry = resolveTargetTypeEntry(targetEntry, typeEntryMap)
  return {
    label,
    noteIcon: targetEntry.icon ?? null,
    typeIcon: targetEntry.isA ? getTypeIcon(targetEntry.isA, typeEntry?.icon) : null,
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

function resolveStatusChip(value: ChipScalarValue): PropertyChipValue | null {
  const label = formatChipLabel(value)
  if (!label) return null

  const status = String(value)
  const style = getMappedStatusStyle(status)
  return {
    label: `• ${label}`,
    noteIcon: null,
    typeIcon: null,
    style: style ? { backgroundColor: style.bg, color: style.color } : undefined,
    tone: 'status',
  }
}

function resolvePropertyValueChip(propName: string, value: ChipScalarValue | undefined): PropertyChipValue | null {
  if (value === undefined) return null
  if (detectPropertyType(propName, value) !== 'status') {
    return resolveScalarChip(value)
  }
  return resolveStatusChip(value)
}

function resolveRelationshipChipValues(
  entry: VaultEntry,
  propName: string,
  allEntries: VaultEntry[],
  typeEntryMap: Record<string, VaultEntry>,
): PropertyChipValue[] | null {
  const relationshipKey = findMatchingKey(entry.relationships, propName)
  if (!relationshipKey) return null
  return entry.relationships[relationshipKey]
    .map((ref) => resolveRelationshipChip(ref, allEntries, typeEntryMap))
    .filter((chip): chip is PropertyChipValue => chip !== null)
}

function resolveScalarChipValues(entry: VaultEntry, propName: string): PropertyChipValue[] {
  const propertyKey = findMatchingKey(entry.properties, propName)
  if (!propertyKey) return []

  const rawValue = entry.properties[propertyKey]
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  return values
    .map((value) => resolvePropertyValueChip(propertyKey, value))
    .filter((chip): chip is PropertyChipValue => chip !== null)
}

function resolvePropertyChipValues(
  entry: VaultEntry,
  propName: string,
  allEntries: VaultEntry[],
  typeEntryMap: Record<string, VaultEntry>,
): PropertyChipValue[] {
  if (propName.toLowerCase() === 'status') {
    const statusChip = resolvePropertyValueChip(propName, entry.status)
    return statusChip ? [statusChip] : []
  }

  return resolveRelationshipChipValues(entry, propName, allEntries, typeEntryMap) ?? resolveScalarChipValues(entry, propName)
}

function RelationshipTypeIcon({
  typeIcon,
}: {
  typeIcon?: ComponentType<SVGAttributes<SVGSVGElement>> | null
}) {
  if (!typeIcon) return null
  return createElement(typeIcon, { 'aria-hidden': true, width: 11, height: 11, className: 'shrink-0' })
}

function renderResolvedNoteIcon(
  noteIcon: string | null | undefined,
  imageFailed: boolean,
  onImageError: () => void,
): ReactNode {
  const resolvedNoteIcon = resolveNoteIcon(noteIcon)

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

  if (resolvedNoteIcon.kind !== 'image' || imageFailed) return null

  return (
    <img
      src={resolvedNoteIcon.src}
      alt=""
      aria-hidden="true"
      className="h-[11px] w-[11px] shrink-0 rounded-sm object-cover"
      onError={onImageError}
    />
  )
}

function PropertyChipIcon({
  noteIcon,
  typeIcon,
  tone,
}: {
  noteIcon?: string | null
  typeIcon?: ComponentType<SVGAttributes<SVGSVGElement>> | null
  tone: PropertyChipValue['tone']
}) {
  const [imageFailed, setImageFailed] = useState(false)

  if (tone === 'url') {
    return <Link aria-hidden="true" width={11} height={11} className="shrink-0" />
  }

  const noteIconElement = renderResolvedNoteIcon(noteIcon, imageFailed, () => setImageFailed(true))
  if (noteIconElement) return noteIconElement
  return <RelationshipTypeIcon typeIcon={typeIcon} />
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
