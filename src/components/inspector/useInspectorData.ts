import { useMemo } from 'react'
import type { VaultEntry } from '../../types'
import { wikilinkTarget } from '../../utils/wikilink'
import type { ReferencedByItem, BacklinkItem } from '../InspectorPanels'

function targetMatchesEntry(target: string, entryPath: string, matchTargets: Set<string>): boolean {
  if (matchTargets.has(target)) return true
  const lastSegment = target.split('/').pop() ?? ''
  if (matchTargets.has(lastSegment)) return true
  if (target.includes('/') && entryPath.toLowerCase().endsWith('/' + target.toLowerCase() + '.md')) return true
  return false
}

function refsMatchTargets(refs: string[], entryPath: string, targets: Set<string>): boolean {
  return refs.some((ref) => {
    const target = wikilinkTarget(ref)
    return targetMatchesEntry(target, entryPath, targets)
  })
}

export function useReferencedBy(entry: VaultEntry | null, entries: VaultEntry[]): ReferencedByItem[] {
  return useMemo(() => {
    if (!entry) return []

    const filenameStem = entry.filename.replace(/\.md$/, '')
    const matchTargets = new Set([filenameStem, entry.title, ...entry.aliases])
    const results: ReferencedByItem[] = []

    for (const other of entries) {
      if (other.path === entry.path) continue
      for (const [key, refs] of Object.entries(other.relationships)) {
        if (key !== 'Type' && refsMatchTargets(refs, entry.path, matchTargets)) {
          results.push({ entry: other, viaKey: key })
        }
      }
    }

    return results
  }, [entry, entries])
}

export function useBacklinks(
  entry: VaultEntry | null,
  entries: VaultEntry[],
  referencedBy: ReferencedByItem[],
): BacklinkItem[] {
  return useMemo(() => {
    if (!entry) return []

    const matchTargets = new Set([
      entry.title,
      ...entry.aliases,
      entry.filename.replace(/\.md$/, ''),
    ])
    const referencedByPaths = new Set(referencedBy.map((item) => item.entry.path))

    return entries
      .filter((other) => {
        if (other.path === entry.path) return false
        if (referencedByPaths.has(other.path)) return false
        return other.outgoingLinks.some((target) => targetMatchesEntry(target, entry.path, matchTargets))
      })
      .map((other) => ({ entry: other, context: null }))
  }, [entry, entries, referencedBy])
}
