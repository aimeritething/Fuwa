import { memo } from 'react'
import type { VaultEntry, PinnedPropertyConfig } from '../types'
import { resolveIcon } from '../utils/iconRegistry'
import { getStatusStyle } from '../utils/statusStyles'
import { wikilinkDisplay } from '../utils/wikilink'
import { resolvePinIcon } from '../hooks/usePinnedProperties'
import type { FrontmatterValue } from './Inspector'

function resolveNoteValue(entry: VaultEntry, key: string): { value: FrontmatterValue; isRelationship: boolean } {
  const lowerKey = key.toLowerCase().replace(/\s+/g, '_')
  if (lowerKey === 'status') return { value: entry.status, isRelationship: false }
  const relValue = entry.relationships[key]
  if (relValue && relValue.length > 0) {
    return { value: relValue.length === 1 ? relValue[0] : relValue, isRelationship: true }
  }
  const propValue = entry.properties[key]
  if (propValue != null) return { value: propValue, isRelationship: false }
  return { value: null, isRelationship: false }
}

function formatCompactValue(value: FrontmatterValue, isRelationship: boolean): string | null {
  if (value == null) return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return isRelationship ? wikilinkDisplay(value) : value
  if (Array.isArray(value)) {
    const items = value.map((v) => (isRelationship ? wikilinkDisplay(String(v)) : String(v)))
    if (items.length <= 2) return items.join(', ')
    return `${items[0]}, +${items.length - 1}`
  }
  return null
}

function chipStyle(key: string, value: FrontmatterValue, isRelationship: boolean): { bg: string; color: string } {
  if (key.toLowerCase() === 'status' && typeof value === 'string') return getStatusStyle(value)
  if (isRelationship) return { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }
  return { bg: 'var(--muted)', color: 'var(--muted-foreground)' }
}

function ChipIcon({ name }: { name: string }) {
  const Icon = resolveIcon(name)
  // eslint-disable-next-line react-hooks/static-components -- icon from static registry, no internal state
  return <Icon width={10} height={10} style={{ flexShrink: 0 }} />
}

function NoteListChip({ config, entry }: { config: PinnedPropertyConfig; entry: VaultEntry }) {
  const { value, isRelationship } = resolveNoteValue(entry, config.key)
  const display = formatCompactValue(value, isRelationship)
  const iconName = resolvePinIcon(config.key, config.icon)
  const colors = chipStyle(config.key, value, isRelationship)

  if (!display) return null

  return (
    <span
      className="inline-flex items-center gap-0.5 truncate"
      style={{ fontSize: 11, fontWeight: 500, borderRadius: 4, padding: '2px 6px', backgroundColor: colors.bg, color: colors.color, maxWidth: 140 }}
      data-testid="pinned-chip"
    >
      <ChipIcon name={iconName} />
      <span className="truncate">{display}</span>
    </span>
  )
}

export const NoteListPinnedValues = memo(function NoteListPinnedValues({ entry, pinnedConfigs }: { entry: VaultEntry; pinnedConfigs: PinnedPropertyConfig[] }) {
  const configs = pinnedConfigs.filter((c) => c.key.toLowerCase() !== 'type')
  if (configs.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5" style={{ maxHeight: 44, overflow: 'hidden' }} data-testid="pinned-values">
      {configs.map((cfg) => (
        <NoteListChip key={cfg.key} config={cfg} entry={entry} />
      ))}
    </div>
  )
})
