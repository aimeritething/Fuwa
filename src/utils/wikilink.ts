/** Utility functions for parsing wikilink syntax: [[target|display]] */

import type { VaultEntry } from '../types'

/** Extracts the target path from a wikilink reference (strips [[ ]] and display text). */
export function wikilinkTarget(ref: string): string {
  const inner = ref.replace(/^\[\[|\]\]$/g, '')
  const pipeIdx = inner.indexOf('|')
  return pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner
}

/** Extracts the display label from a wikilink reference. Falls back to humanised path stem. */
export function wikilinkDisplay(ref: string): string {
  const inner = ref.replace(/^\[\[|\]\]$/g, '')
  const pipeIdx = inner.indexOf('|')
  if (pipeIdx !== -1) return inner.slice(pipeIdx + 1)
  const last = inner.split('/').pop() ?? inner
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Unified wikilink resolution: find the VaultEntry matching a wikilink target.
 * Handles pipe syntax, case-insensitive matching.
 * Resolution order (multi-pass, global priority):
 *   1. Filename stem match (strongest — filename IS the identity in flat vault)
 *   2. Alias match
 *   3. Exact title match
 *   4. Humanized title match (kebab-case → words)
 * No path-based matching — flat vault uses title/filename only.
 * Legacy path-style targets like "person/alice" are handled by extracting the last segment.
 */
export function resolveEntry(entries: VaultEntry[], rawTarget: string): VaultEntry | undefined {
  const key = rawTarget.includes('|') ? rawTarget.split('|')[0] : rawTarget
  const keyLower = key.toLowerCase()
  // For legacy path-style targets like "person/alice", extract just the last segment
  const lastSegment = key.includes('/') ? (key.split('/').pop() ?? key) : key
  const lastSegmentLower = lastSegment.toLowerCase()
  const asWords = lastSegmentLower.replace(/-/g, ' ')

  // Pass 1: filename stem (strongest match — filename IS identity in flat vault)
  for (const e of entries) {
    const stem = e.filename.replace(/\.md$/, '').toLowerCase()
    if (stem === keyLower || stem === lastSegmentLower) return e
  }
  // Pass 2: alias
  for (const e of entries) {
    if (e.aliases.some(a => a.toLowerCase() === keyLower)) return e
  }
  // Pass 3: exact title
  for (const e of entries) {
    if (e.title.toLowerCase() === keyLower || e.title.toLowerCase() === lastSegmentLower) return e
  }
  // Pass 4: humanized title (kebab-case → words)
  if (asWords !== keyLower) {
    for (const e of entries) {
      if (e.title.toLowerCase() === asWords) return e
    }
  }
  return undefined
}
