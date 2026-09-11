import { splitFrontmatter } from './wikilinks'

/**
 * What the path row and the Tab rules need to know about a Document's
 * Frontmatter (spec section 3, AIM-381): whether there is a block, how many
 * top-level keys it holds, or why it cannot be trusted. The bytes themselves
 * are never touched here; `splitFrontmatter` is the same cut the serializer
 * uses to carry them through a Rich-mode save unchanged.
 *
 * Invalid means Rich mode could not round-trip the bytes: an opening `---`
 * with no closing line (Rich would render it as a rule and rewrite it), a
 * non-empty block with no `key:` line, or tab indentation, which YAML
 * forbids. Such a Document is always in Raw mode. One predicate decides what
 * a key line is, for the validity check and the count alike: the shape the
 * kernel's `parseFrontmatter` accepts, an unindented `key:` with the key
 * optionally quoted. This is a structural check, not a YAML parse: a block
 * with a key line and a broken value still reads as valid, and the bytes are
 * carried through a Rich-mode save untouched either way.
 */
export type FrontmatterStatus =
  | { kind: 'none' }
  | { kind: 'valid'; keyCount: number }
  | { kind: 'invalid'; reason: 'unclosed' | 'no-keys' | 'tab-indented' }

const NONE: FrontmatterStatus = { kind: 'none' }
const TOP_LEVEL_KEY_LINE = /^["']?[^"':\s][^"':]*["']?\s*:/

function isTopLevelKeyLine(line: string): boolean {
  return TOP_LEVEL_KEY_LINE.test(line)
}

/** Blank lines and YAML comments say nothing about validity. */
function isContentLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed !== '' && !trimmed.startsWith('#')
}

function opensFrontmatter(content: string): boolean {
  return content.startsWith('---\n') || content.startsWith('---\r\n')
}

/** The lines between the two `---` delimiters. */
function frontmatterBodyLines(frontmatter: string): string[] {
  return frontmatter.trimEnd().split(/\r?\n/).slice(1, -1)
}

export function documentFrontmatter(content: string): FrontmatterStatus {
  if (!opensFrontmatter(content)) return NONE
  const [frontmatter] = splitFrontmatter(content)
  if (frontmatter === '') return { kind: 'invalid', reason: 'unclosed' }
  const lines = frontmatterBodyLines(frontmatter)
  if (lines.some((line) => line.startsWith('\t'))) return { kind: 'invalid', reason: 'tab-indented' }
  const keyCount = lines.filter(isTopLevelKeyLine).length
  if (keyCount === 0 && lines.some(isContentLine)) return { kind: 'invalid', reason: 'no-keys' }
  return { kind: 'valid', keyCount }
}

/** The Tab rule: a Document whose Frontmatter is invalid stays in Raw mode. */
export function frontmatterForcesRaw(content: string): boolean {
  return documentFrontmatter(content).kind === 'invalid'
}

/** The path row's mono badge, or null when there is nothing to badge. */
export function frontmatterBadgeLabel(status: FrontmatterStatus): string | null {
  switch (status.kind) {
    case 'none':
      return null
    case 'invalid':
      return 'frontmatter · invalid'
    case 'valid':
      return `frontmatter · ${status.keyCount} ${status.keyCount === 1 ? 'key' : 'keys'}`
  }
}
