import type { FrontmatterValue } from '../components/Inspector'

export interface ParsedFrontmatter {
  [key: string]: FrontmatterValue
}

function unquote(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

function collapseList(items: string[]): FrontmatterValue {
  return items.length === 1 ? items[0] : items
}

function isBlockScalar(value: string): boolean {
  return value === '' || value === '|' || value === '>'
}

function isInlineArrayLiteral(value: string): boolean {
  return value.startsWith('[') && value.endsWith(']') && !value.startsWith('[[')
}

function parseInlineArray(value: string): FrontmatterValue {
  const items = value.slice(1, -1).split(',').map(s => unquote(s.trim()))
  return collapseList(items)
}

function parseScalar(value: string): FrontmatterValue {
  const clean = unquote(value)
  const lower = clean.toLowerCase()
  if (lower === 'true' || lower === 'yes') return true
  if (lower === 'false' || lower === 'no') return false
  if (clean === value && /^-?\d+(\.\d+)?$/.test(clean)) return Number(clean)
  return clean
}

export type FrontmatterState = 'valid' | 'empty' | 'none' | 'invalid'

/** Detect whether content has valid, empty, missing, or invalid frontmatter. */
export function detectFrontmatterState(content: string | null): FrontmatterState {
  if (!content) return 'none'
  const match = content.match(/^---\n([\s\S]*?)---/)
  if (!match) return 'none'
  const body = match[1].trim()
  if (!body) return 'empty'
  // Valid frontmatter needs at least one line starting with a word character followed by colon
  const hasValidLine = body.split('\n').some(line => /^[A-Za-z][\w -]*:/.test(line))
  return hasValidLine ? 'valid' : 'invalid'
}

function extractFrontmatterBody(content: string | null): string | null {
  if (!content) return null
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  return match ? match[1] : null
}

function parseListItem(line: string): string | null {
  const match = line.match(/^ {2}- (.*)$/)
  return match ? unquote(match[1]) : null
}

function parseKeyValueLine(line: string): { key: string, value: string } | null {
  const match = line.match(/^["']?([^"':]+)["']?\s*:\s*(.*)$/)
  if (!match) return null
  return {
    key: match[1].trim(),
    value: match[2].trim(),
  }
}

function parseFrontmatterValue(value: string): FrontmatterValue | undefined {
  if (isBlockScalar(value)) return undefined
  if (isInlineArrayLiteral(value)) return parseInlineArray(value)
  return parseScalar(value)
}

function flushList(
  result: ParsedFrontmatter,
  currentKey: string | null,
  currentList: string[],
): string[] {
  if (currentKey && currentList.length > 0) {
    result[currentKey] = collapseList(currentList)
  }
  return []
}

/** Parse YAML frontmatter from content */
export function parseFrontmatter(content: string | null): ParsedFrontmatter {
  const frontmatterBody = extractFrontmatterBody(content)
  if (frontmatterBody === null) return {}

  const result: ParsedFrontmatter = {}
  let currentKey: string | null = null
  let currentList: string[] = []

  for (const line of frontmatterBody.split('\n')) {
    const listItem = parseListItem(line)
    if (listItem !== null && currentKey) {
      currentList.push(listItem)
      continue
    }

    currentList = flushList(result, currentKey, currentList)

    const keyValue = parseKeyValueLine(line)
    if (!keyValue) continue
    currentKey = keyValue.key

    const parsedValue = parseFrontmatterValue(keyValue.value)
    if (parsedValue !== undefined) {
      result[currentKey] = parsedValue
    }
  }

  flushList(result, currentKey, currentList)
  return result
}
