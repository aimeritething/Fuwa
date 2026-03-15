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
 * Resolution order: filename stem (primary) → alias → title (fallback).
 * Handles pipe syntax, case-insensitive matching.
 */
export function resolveEntry(entries: VaultEntry[], rawTarget: string): VaultEntry | undefined {
  const key = rawTarget.includes('|') ? rawTarget.split('|')[0] : rawTarget
  const keyLower = key.toLowerCase()
  const lastSegment = key.split('/').pop() ?? key
  const asWords = lastSegment.replace(/-/g, ' ').toLowerCase()

  // 1. Filename stem match (primary — filename IS identity in flat vault)
  const byStem = entries.find(e => {
    const stem = e.filename.replace(/\.md$/, '')
    return stem.toLowerCase() === keyLower || stem.toLowerCase() === lastSegment.toLowerCase()
  })
  if (byStem) return byStem

  // 2. Alias match
  const byAlias = entries.find(e => e.aliases.some(a => a.toLowerCase() === keyLower))
  if (byAlias) return byAlias

  // 3. Title match (fallback)
  return entries.find(e =>
    e.title.toLowerCase() === keyLower || e.title.toLowerCase() === asWords,
  )
}
