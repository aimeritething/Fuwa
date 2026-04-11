import type { CommandAction } from './types'
import type { SidebarSelection, VaultEntry } from '../../types'

const PLURAL_OVERRIDES: Record<string, string> = {
  Person: 'People',
  Responsibility: 'Responsibilities',
}

const DEFAULT_TYPES = ['Event', 'Person', 'Project', 'Note']
const DEFAULT_TYPE_CANONICAL_CASE = new Map(
  DEFAULT_TYPES.map(type => [type.toLowerCase(), type] as const),
)

function canonicalizeTypeName(type: string): string | null {
  const trimmedType = type.trim()
  if (!trimmedType) return null
  return DEFAULT_TYPE_CANONICAL_CASE.get(trimmedType.toLowerCase()) ?? trimmedType
}

export function pluralizeType(type: string): string {
  if (PLURAL_OVERRIDES[type]) return PLURAL_OVERRIDES[type]
  if (type.endsWith('s') || type.endsWith('x') || type.endsWith('ch') || type.endsWith('sh')) return `${type}es`
  if (type.endsWith('y') && !/[aeiou]y$/i.test(type)) return `${type.slice(0, -1)}ies`
  return `${type}s`
}

export function extractVaultTypes(entries: VaultEntry[]): string[] {
  const typeMap = new Map<string, string>()
  for (const e of entries) {
    const rawType =
      e.isA === 'Type'
        ? e.title
        : e.isA && e.isA !== 'Type'
          ? e.isA
          : null
    if (!rawType) continue

    const canonicalType = canonicalizeTypeName(rawType)
    if (!canonicalType) continue

    const typeKey = canonicalType.toLowerCase()
    if (!typeMap.has(typeKey)) {
      typeMap.set(typeKey, canonicalType)
    }
  }
  if (typeMap.size === 0) return DEFAULT_TYPES
  return Array.from(typeMap.values()).sort()
}

export function buildTypeCommands(
  types: string[],
  onCreateNoteOfType: (type: string) => void,
  onSelect: (sel: SidebarSelection) => void,
): CommandAction[] {
  return types.flatMap((type) => {
    const canonicalType = canonicalizeTypeName(type)
    if (!canonicalType) return []

    const slug = canonicalType.toLowerCase().replace(/\s+/g, '-')
    const plural = pluralizeType(canonicalType)
    const commands: CommandAction[] = []

    if (canonicalType.toLowerCase() !== 'note') {
      commands.push({
        id: `new-${slug}`, label: `New ${canonicalType}`, group: 'Note' as const,
        keywords: ['new', 'create', canonicalType.toLowerCase()],
        enabled: true, execute: () => onCreateNoteOfType(canonicalType),
      })
    }

    commands.push({
      id: `list-${slug}`, label: `List ${plural}`, group: 'Navigation' as const,
      keywords: ['list', 'show', 'filter', canonicalType.toLowerCase(), plural.toLowerCase()],
      enabled: true, execute: () => onSelect({ kind: 'sectionGroup', type: canonicalType }),
    })

    return commands
  })
}
