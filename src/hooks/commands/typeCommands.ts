import type { CommandAction } from './types'
import type { SidebarSelection, VaultEntry } from '../../types'

const PLURAL_OVERRIDES: Record<string, string> = {
  Person: 'People',
  Responsibility: 'Responsibilities',
}

const DEFAULT_TYPES = ['Event', 'Person', 'Project', 'Note']

export function pluralizeType(type: string): string {
  if (PLURAL_OVERRIDES[type]) return PLURAL_OVERRIDES[type]
  if (type.endsWith('s') || type.endsWith('x') || type.endsWith('ch') || type.endsWith('sh')) return `${type}es`
  if (type.endsWith('y') && !/[aeiou]y$/i.test(type)) return `${type.slice(0, -1)}ies`
  return `${type}s`
}

export function extractVaultTypes(entries: VaultEntry[]): string[] {
  const typeSet = new Set<string>()
  for (const e of entries) {
    if (e.trashed) continue
    if (e.isA === 'Type' && e.title) {
      typeSet.add(e.title)
    } else if (e.isA && e.isA !== 'Type') {
      typeSet.add(e.isA)
    }
  }
  if (typeSet.size === 0) return DEFAULT_TYPES
  return Array.from(typeSet).sort()
}

export function buildTypeCommands(
  types: string[],
  onCreateNoteOfType: (type: string) => void,
  onSelect: (sel: SidebarSelection) => void,
): CommandAction[] {
  return types.flatMap((type) => {
    const slug = type.toLowerCase().replace(/\s+/g, '-')
    const plural = pluralizeType(type)
    return [
      {
        id: `new-${slug}`, label: `New ${type}`, group: 'Note' as const,
        keywords: ['new', 'create', type.toLowerCase()],
        enabled: true, execute: () => onCreateNoteOfType(type),
      },
      {
        id: `list-${slug}`, label: `List ${plural}`, group: 'Navigation' as const,
        keywords: ['list', 'show', 'filter', type.toLowerCase(), plural.toLowerCase()],
        enabled: true, execute: () => onSelect({ kind: 'sectionGroup', type }),
      },
    ]
  })
}
