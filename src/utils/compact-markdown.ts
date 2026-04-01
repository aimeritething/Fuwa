/**
 * Post-process BlockNote's blocksToMarkdownLossy output to produce
 * standard-convention Markdown:
 * - Tight lists (no blank lines between consecutive list items)
 * - Bullet list markers normalized to `-` (BlockNote outputs `*`)
 * - HTML entities like `&#x20;` decoded back to spaces
 * - No runs of 3+ blank lines (collapsed to one blank line)
 * - No trailing blank lines
 * - Code block content is never modified
 */
export function compactMarkdown(md: string): string {
  if (!md) return md

  const lines = md.split('\n')
  const result: string[] = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Track fenced code blocks — never modify content inside them
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    if (inCodeBlock) {
      result.push(line)
      continue
    }

    // Normalize bullet markers: BlockNote uses `*`, convention is `-`
    line = normalizeBulletMarker(line)

    // Decode HTML entities that BlockNote inserts (e.g. &#x20; for spaces)
    line = decodeHtmlEntities(line)

    // Skip blank lines that sit between two list items (tight list rule)
    if (line.trim() === '') {
      if (isBlankBetweenListItems(lines, i)) continue
      // Collapse runs of 3+ blank lines to a single blank line
      if (isExcessiveBlankLine(lines, i)) continue
      result.push(line)
      continue
    }

    result.push(line)
  }

  // Trim trailing blank lines, keep exactly one trailing newline
  while (result.length > 0 && result[result.length - 1].trim() === '') {
    result.pop()
  }
  if (result.length > 0) result.push('')

  return result.join('\n')
}

const LIST_RE = /^(\s*)([-*+]|\d+\.)\s/

/** True if this blank line sits between two list items (including nested) */
function isBlankBetweenListItems(lines: string[], idx: number): boolean {
  const prev = findPrevNonBlank(lines, idx)
  const next = findNextNonBlank(lines, idx)
  if (prev === null || next === null) return false
  return LIST_RE.test(lines[prev]) && LIST_RE.test(lines[next])
}

/** True if this blank line is part of a run of 2+ consecutive blank lines
 *  (i.e. would create 3+ newlines in a row — collapse to just one blank line) */
function isExcessiveBlankLine(lines: string[], idx: number): boolean {
  // Keep the first blank line in a run, skip subsequent ones
  if (idx > 0 && lines[idx - 1].trim() === '') return true
  return false
}

function findPrevNonBlank(lines: string[], idx: number): number | null {
  for (let i = idx - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') return i
  }
  return null
}

function findNextNonBlank(lines: string[], idx: number): number | null {
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') return i
  }
  return null
}

const BULLET_RE = /^(\s*)\*(\s)/
/** Normalize `*` bullet markers to `-` (BlockNote default → standard convention) */
function normalizeBulletMarker(line: string): string {
  return line.replace(BULLET_RE, '$1-$2')
}

/** Decode HTML entities that BlockNote inserts (&#x20; &#x26; etc.) */
function decodeHtmlEntities(line: string): string {
  if (!line.includes('&#x')) return line
  return line.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
