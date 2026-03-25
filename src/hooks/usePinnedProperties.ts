import { useMemo, useCallback } from 'react'
import type { VaultEntry, PinnedPropertyConfig } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'

const DEFAULT_ICONS: Record<string, string> = {
  status: 'circle-dot',
  date: 'calendar',
  'belongs to': 'arrow-up-right',
  'related to': 'arrows-left-right',
  'due date': 'calendar',
}

export function resolvePinIcon(key: string, explicit: string | null): string {
  if (explicit) return explicit
  return DEFAULT_ICONS[key.toLowerCase()] ?? 'arrow-up-right'
}

export function serialisePinnedConfig(configs: PinnedPropertyConfig[]): string[] {
  return configs.map((c) => (c.icon ? `${c.key}:${c.icon}` : c.key))
}

export function parsePinnedConfig(items: string[]): PinnedPropertyConfig[] {
  return items.map((s) => {
    const sep = s.indexOf(':')
    if (sep === -1) return { key: s.trim(), icon: null }
    return { key: s.slice(0, sep).trim(), icon: s.slice(sep + 1).trim() || null }
  })
}

function computeDefaults(entries: VaultEntry[], typeName: string): PinnedPropertyConfig[] {
  const sample = entries.find((e) => e.isA === typeName)
  if (!sample) return []
  const pins: PinnedPropertyConfig[] = []
  if (sample.status != null) pins.push({ key: 'Status', icon: 'circle-dot' })
  if (sample.belongsTo.length > 0) pins.push({ key: 'Belongs to', icon: 'arrow-up-right' })
  if (sample.relatedTo.length > 0) pins.push({ key: 'Related to', icon: 'arrows-left-right' })
  return pins
}

export interface ResolvedPinnedProperty {
  key: string
  icon: string
  label: string
  value: FrontmatterValue
  isRelationship: boolean
}

function resolveValue(
  entry: VaultEntry,
  frontmatter: ParsedFrontmatter,
  key: string,
): { value: FrontmatterValue; isRelationship: boolean } {
  const lowerKey = key.toLowerCase().replace(/\s+/g, '_')
  if (lowerKey === 'status') return { value: entry.status, isRelationship: false }
  const relValue = entry.relationships?.[key]
  if (relValue && relValue.length > 0) {
    return { value: relValue.length === 1 ? relValue[0] : relValue, isRelationship: true }
  }
  const propValue = entry.properties?.[key]
  if (propValue != null) return { value: propValue, isRelationship: false }
  const fmValue = frontmatter[key]
  if (fmValue != null) return { value: fmValue, isRelationship: false }
  return { value: null, isRelationship: false }
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ')
}

/** Resolve a single pinned config to its display representation. */
function resolveOne(
  entry: VaultEntry, frontmatter: ParsedFrontmatter, cfg: PinnedPropertyConfig,
): ResolvedPinnedProperty {
  const { value, isRelationship } = resolveValue(entry, frontmatter, cfg.key)
  return { key: cfg.key, icon: resolvePinIcon(cfg.key, cfg.icon), label: formatLabel(cfg.key), value, isRelationship }
}

/** Find the Type entry for a note's isA field. */
function findTypeEntry(entries: VaultEntry[], isA: string | null): VaultEntry | null {
  if (!isA) return null
  return entries.find((e) => e.isA === 'Type' && e.title === isA) ?? null
}

/** Determine which properties are pinned for a given type. */
function resolvePinnedConfigs(
  isA: string | null, typeEntry: VaultEntry | null, entries: VaultEntry[],
): PinnedPropertyConfig[] {
  if (!isA) return []
  if (typeEntry && typeEntry.pinnedProperties.length > 0) return typeEntry.pinnedProperties
  return computeDefaults(entries, isA)
}

export interface UsePinnedPropertiesResult {
  pinnedConfigs: PinnedPropertyConfig[]
  resolved: ResolvedPinnedProperty[]
  pinProperty: (key: string, icon?: string) => void
  unpinProperty: (key: string) => void
  updatePinIcon: (key: string, icon: string) => void
  reorderPins: (configs: PinnedPropertyConfig[]) => void
  isPinned: (key: string) => boolean
}

/** Hook to read and mutate pinned properties for a note based on its type. */
export function usePinnedProperties({
  entry, entries, frontmatter, onUpdateTypeFrontmatter,
}: {
  entry: VaultEntry | null
  entries: VaultEntry[]
  frontmatter: ParsedFrontmatter
  onUpdateTypeFrontmatter?: (typePath: string, key: string, value: FrontmatterValue) => Promise<void>
}): UsePinnedPropertiesResult {
  const typeEntry = useMemo(() => findTypeEntry(entries, entry?.isA ?? null), [entry?.isA, entries])
  const pinnedConfigs = useMemo(
    () => resolvePinnedConfigs(entry?.isA ?? null, typeEntry, entries),
    [entry?.isA, typeEntry, entries],
  )
  const resolved = useMemo(
    () => (entry ? pinnedConfigs.map((cfg) => resolveOne(entry, frontmatter, cfg)) : []),
    [entry, pinnedConfigs, frontmatter],
  )
  const savePins = useCallback(
    (newConfigs: PinnedPropertyConfig[]) => {
      if (!typeEntry || !onUpdateTypeFrontmatter) return
      onUpdateTypeFrontmatter(typeEntry.path, '_pinned_properties', serialisePinnedConfig(newConfigs))
    },
    [typeEntry, onUpdateTypeFrontmatter],
  )
  const pinProperty = useCallback(
    (key: string, icon?: string) => {
      if (pinnedConfigs.some((c) => c.key === key)) return
      savePins([...pinnedConfigs, { key, icon: icon ?? null }])
    },
    [pinnedConfigs, savePins],
  )
  const unpinProperty = useCallback(
    (key: string) => savePins(pinnedConfigs.filter((c) => c.key !== key)),
    [pinnedConfigs, savePins],
  )
  const updatePinIcon = useCallback(
    (key: string, icon: string) => savePins(pinnedConfigs.map((c) => (c.key === key ? { ...c, icon } : c))),
    [pinnedConfigs, savePins],
  )
  const reorderPins = useCallback((configs: PinnedPropertyConfig[]) => savePins(configs), [savePins])
  const isPinned = useCallback((key: string) => pinnedConfigs.some((c) => c.key === key), [pinnedConfigs])

  return { pinnedConfigs, resolved, pinProperty, unpinProperty, updatePinIcon, reorderPins, isPinned }
}
