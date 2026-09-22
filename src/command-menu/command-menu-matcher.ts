/**
 * The Command Menu's matcher: pure ranking over the
 * rows the palette can show. New Plumo code. Names only: a Document matches by its file name, an Image file by
 * its file name, a command by its menu label. Contents and parent paths are
 * never searched.
 *
 * Two modes. ⌘K (`commands`) lists every command while the query is empty and
 * matches commands and file names together once the user types. ⌘P
 * (`files`) is Quick Open: files only, every file while the query is empty.
 */

export type CommandMenuEntryKind = 'command' | 'document' | 'image'

export type CommandMenuMode = 'commands' | 'files'

export interface CommandMenuEntry {
  kind: CommandMenuEntryKind
  /** The command id, or the file's absolute path. */
  id: string
  /** What the matcher reads: the menu label or the file name. */
  name: string
  /** Muted, after the name: the menu a command lives in, or a file's parent path. */
  detail?: string
  /** Commands only: the shortcut display, `⌘S`. */
  shortcut?: string
  /** Commands only: false while the menu item is greyed. Default true. */
  enabled?: boolean
}

/** `[start, end)` offsets into the entry's name, for emphasising the matched characters. */
export type CommandMenuRange = [number, number]

export interface CommandMenuMatch {
  entry: CommandMenuEntry
  score: number
  ranges: CommandMenuRange[]
}

interface FuzzyMatch {
  score: number
  ranges: CommandMenuRange[]
}

const CONTIGUOUS_SCORE = 100
const SUBSEQUENCE_SCORE = 40
const TEXT_START_BONUS = 30
const WORD_START_BONUS = 15
const CONSECUTIVE_BONUS = 4
const GAP_PENALTY = 1
const LENGTH_PENALTY = 0.05

const KIND_ORDER: Record<CommandMenuEntryKind, number> = { command: 0, document: 1, image: 2 }

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true
  const previous = text[index - 1]
  if (!/[\p{L}\p{N}]/u.test(previous)) return true
  // A camel-case boundary: `RichRaw` starts a word at the second capital.
  return /\p{Ll}/u.test(previous) && /\p{Lu}/u.test(text[index])
}

function mergeRanges(indices: readonly number[]): CommandMenuRange[] {
  const ranges: CommandMenuRange[] = []
  for (const index of indices) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === index) last[1] = index + 1
    else ranges.push([index, index + 1])
  }
  return ranges
}

/** The matched offsets of a contiguous hit, minus the query's own spaces. */
function contiguousRanges(query: string, index: number): CommandMenuRange[] {
  const indices: number[] = []
  for (let offset = 0; offset < query.length; offset += 1) {
    if (!/\s/u.test(query[offset])) indices.push(index + offset)
  }
  return mergeRanges(indices)
}

function contiguousMatch(query: string, text: string, lowerText: string): FuzzyMatch | null {
  const index = lowerText.indexOf(query)
  if (index === -1) return null
  let score = CONTIGUOUS_SCORE
  if (index === 0) score += TEXT_START_BONUS + WORD_START_BONUS
  else if (isWordStart(text, index)) score += WORD_START_BONUS
  return { score: score - text.length * LENGTH_PENALTY, ranges: contiguousRanges(query, index) }
}

function subsequenceMatch(query: string, text: string, lowerText: string): FuzzyMatch | null {
  const indices: number[] = []
  let score = SUBSEQUENCE_SCORE
  let cursor = 0
  for (const character of query) {
    const index = lowerText.indexOf(character, cursor)
    if (index === -1) return null
    const previous = indices[indices.length - 1]
    if (previous !== undefined) {
      if (index === previous + 1) score += CONSECUTIVE_BONUS
      else score -= Math.min(index - previous - 1, 10) * GAP_PENALTY
    }
    if (isWordStart(text, index)) score += index === 0 ? TEXT_START_BONUS : WORD_START_BONUS
    indices.push(index)
    cursor = index + 1
  }
  return { score: score - text.length * LENGTH_PENALTY, ranges: mergeRanges(indices) }
}

/**
 * Case-insensitive fuzzy match of `query` against `text`. A contiguous
 * occurrence always outranks a scattered one; within each, a match at the
 * start of the text beats one at a word start, which beats one inside a word.
 * Whitespace in the query is ignored, so `toggle side` still finds
 * `Toggle Sidebar`. Null when a character of the query is missing.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const compact = query.replace(/\s+/gu, '')
  if (compact.length === 0) return null
  const lowerQuery = compact.toLowerCase()
  const lowerText = text.toLowerCase()
  if (lowerQuery.length > lowerText.length) return null

  const spaced = query.trim().toLowerCase()
  return contiguousMatch(spaced, text, lowerText)
    ?? contiguousMatch(lowerQuery, text, lowerText)
    ?? subsequenceMatch(lowerQuery, text, lowerText)
}

function compareByKindThenName(a: CommandMenuEntry, b: CommandMenuEntry): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

function compareMatches(a: CommandMenuMatch, b: CommandMenuMatch): number {
  return b.score - a.score || compareByKindThenName(a.entry, b.entry)
}

function isFile(entry: CommandMenuEntry): boolean {
  return entry.kind !== 'command'
}

function unranked(entries: readonly CommandMenuEntry[]): CommandMenuMatch[] {
  return entries.map((entry) => ({ entry, score: 0, ranges: [] }))
}

/**
 * The rows to show for `query` in `mode`, best first. With an empty query,
 * ⌘K shows the commands in manifest order and Quick Open shows every file by
 * name; typing ranks whatever matches.
 */
export function matchCommandMenu(
  entries: readonly CommandMenuEntry[],
  query: string,
  mode: CommandMenuMode,
): CommandMenuMatch[] {
  const candidates = mode === 'files' ? entries.filter(isFile) : entries
  if (query.trim().length === 0) {
    if (mode === 'files') {
      return unranked(candidates.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))
    }
    return unranked(candidates.filter((entry) => !isFile(entry)))
  }

  const matches: CommandMenuMatch[] = []
  for (const entry of candidates) {
    const match = fuzzyMatch(query, entry.name)
    if (match) matches.push({ entry, ...match })
  }
  return matches.sort(compareMatches)
}
