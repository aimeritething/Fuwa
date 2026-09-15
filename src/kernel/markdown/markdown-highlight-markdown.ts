import {
  serializeBlockNoteMarkdown,
  type DirectMarkdownCapableSerializer,
} from './block-note-direct-markdown'

export const MARKDOWN_HIGHLIGHT_STYLE = 'highlight' as const
const MARKDOWN_HIGHLIGHT_DELIMITER = '=='
export const MARKDOWN_HIGHLIGHT_COLOR_OPTIONS = [
  { color: 'yellow', localeKey: 'editor.formatting.highlightYellow', markdownPrefix: '' },
  { color: 'green', localeKey: 'editor.formatting.highlightGreen', markdownPrefix: '🟢' },
  { color: 'red', localeKey: 'editor.formatting.highlightRed', markdownPrefix: '🔴' },
  { color: 'blue', localeKey: 'editor.formatting.highlightBlue', markdownPrefix: '🔵' },
  { color: 'purple', localeKey: 'editor.formatting.highlightPurple', markdownPrefix: '🟣' },
] as const

export type MarkdownHighlightColor = typeof MARKDOWN_HIGHLIGHT_COLOR_OPTIONS[number]['color']

export const DEFAULT_MARKDOWN_HIGHLIGHT_COLOR = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS[0].color
export const MARKDOWN_HIGHLIGHT_COLORS = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.map(({ color }) => color)

interface TextStyles {
  [style: string]: string | boolean | undefined
}

interface InlineItem {
  type: string
  text?: string
  styles?: TextStyles
  content?: unknown
  props?: Record<string, string>
  [key: string]: unknown
}

interface BlockLike {
  type?: string
  content?: BlockContent
  props?: Record<string, string>
  children?: BlockLike[]
  [key: string]: unknown
}

interface TableContentLike {
  type?: string
  rows?: TableRowLike[]
  [key: string]: unknown
}

interface TableRowLike {
  cells?: TableCellValue[]
  [key: string]: unknown
}

interface TableCellLike {
  content?: InlineItem[]
  [key: string]: unknown
}

type MarkdownSerializer = DirectMarkdownCapableSerializer

type BlockContent = unknown
type TableCellValue = TableCellLike | string
type InlineContentTransform = (content: InlineItem[]) => InlineItem[]
type InlineSegment = { kind: 'delimiter'; literal: InlineItem } | { kind: 'item'; item: InlineItem }

function isTextItem(item: InlineItem): item is InlineItem & { text: string } {
  return item.type === 'text' && typeof item.text === 'string'
}

function isCodeTextItem(item: InlineItem): boolean {
  return item.styles?.code === true
}

function textItemWithText(item: InlineItem, text: string): InlineItem {
  return { ...item, text }
}

export function markdownHighlightPrefix(color: MarkdownHighlightColor): string {
  return markdownHighlightColorOption(color).markdownPrefix
}

export function markdownHighlightColorOption(color: MarkdownHighlightColor) {
  return MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.find(option => option.color === color)
    ?? MARKDOWN_HIGHLIGHT_COLOR_OPTIONS[0]
}

export function readMarkdownHighlightPrefix(text: string): {
  color: MarkdownHighlightColor
  text: string
} {
  const option = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.find(candidate => (
    candidate.markdownPrefix.length > 0 && text.startsWith(candidate.markdownPrefix)
  ))
  if (!option) return { color: DEFAULT_MARKDOWN_HIGHLIGHT_COLOR, text }

  return {
    color: option.color,
    text: text.slice(option.markdownPrefix.length),
  }
}

export function markdownHighlightColorFromStyles(styles: {
  backgroundColor?: unknown
  highlight?: unknown
} | undefined): MarkdownHighlightColor | null {
  if (styles?.highlight !== true) return null

  const customColor = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.find(option => (
    option.color !== DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
      && option.color === styles.backgroundColor
  ))
  return customColor?.color ?? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
}

function pushTextSegment(segments: InlineSegment[], item: InlineItem, text: string): void {
  if (text) segments.push({ kind: 'item', item: textItemWithText(item, text) })
}

// Each delimiter keeps the item it was cut from, so a pair that turns out not
// to be a highlight goes back as literal text in its original styles.
function splitTextItemAtHighlightDelimiters(item: InlineItem): InlineSegment[] {
  if (!isTextItem(item) || isCodeTextItem(item)) return [{ kind: 'item', item }]

  const segments: InlineSegment[] = []
  let cursor = 0
  let delimiterIndex = item.text.indexOf(MARKDOWN_HIGHLIGHT_DELIMITER)

  while (delimiterIndex !== -1) {
    pushTextSegment(segments, item, item.text.slice(cursor, delimiterIndex))
    segments.push({ kind: 'delimiter', literal: textItemWithText(item, MARKDOWN_HIGHLIGHT_DELIMITER) })
    cursor = delimiterIndex + MARKDOWN_HIGHLIGHT_DELIMITER.length
    delimiterIndex = item.text.indexOf(MARKDOWN_HIGHLIGHT_DELIMITER, cursor)
  }

  pushTextSegment(segments, item, item.text.slice(cursor))
  return segments
}

function delimiterCount(segments: InlineSegment[]): number {
  return segments.filter(segment => segment.kind === 'delimiter').length
}

function addHighlightStyle(item: InlineItem, color: MarkdownHighlightColor): InlineItem {
  if (!isTextItem(item)) return item
  const styles = { ...(item.styles ?? {}) }
  delete styles.backgroundColor

  return {
    ...item,
    styles: {
      ...styles,
      highlight: true,
      ...(color === DEFAULT_MARKDOWN_HIGHLIGHT_COLOR ? {} : { backgroundColor: color }),
    },
  }
}

// The items between one delimiter pair as highlighted content, or null when
// the pair holds nothing (`====`, `==🔴==`): the colour prefix is read off the
// first text item and dropped.
function highlightPairContent(items: InlineItem[]): InlineItem[] | null {
  const [first, ...rest] = items
  if (!first) return null

  let color: MarkdownHighlightColor = DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
  let content = items
  if (isTextItem(first)) {
    const prefixed = readMarkdownHighlightPrefix(first.text)
    color = prefixed.color
    content = prefixed.text.length === 0 ? rest : [textItemWithText(first, prefixed.text), ...rest]
  }
  if (content.length === 0) return null

  return content.map(item => addHighlightStyle(item, color))
}

function segmentItems(segments: InlineSegment[]): InlineItem[] {
  return segments.map(segment => segment.kind === 'item' ? segment.item : segment.literal)
}

function injectMarkdownHighlights(content: InlineItem[]): InlineItem[] {
  const segments = content.flatMap(splitTextItemAtHighlightDelimiters)
  const delimiters = delimiterCount(segments)
  if (delimiters === 0 || delimiters % 2 !== 0) return content

  const injected: InlineItem[] = []
  let index = 0
  while (index < segments.length) {
    const segment = segments[index]
    if (segment.kind === 'item') {
      injected.push(segment.item)
      index += 1
      continue
    }

    const closing = segments.findIndex((candidate, at) => at > index && candidate.kind === 'delimiter')
    const inner = segments.slice(index + 1, closing)
    const highlighted = highlightPairContent(segmentItems(inner))
    if (highlighted) {
      injected.push(...highlighted)
    } else {
      injected.push(segment.literal, ...segmentItems(inner), (segments[closing] as { literal: InlineItem }).literal)
    }
    index = closing + 1
  }
  return injected
}

function withoutHighlightStyle(styles: TextStyles | undefined): TextStyles {
  const rest = { ...(styles ?? {}) }
  const color = markdownHighlightColorFromStyles(rest)
  delete rest.highlight
  if (color !== DEFAULT_MARKDOWN_HIGHLIGHT_COLOR && rest.backgroundColor === color) {
    delete rest.backgroundColor
  }
  return rest
}

function isHighlightedTextItem(item: InlineItem): boolean {
  return isTextItem(item) && item.styles?.highlight === true
}

function highlightMarker(prefix = ''): InlineItem {
  return { type: 'text', text: `${MARKDOWN_HIGHLIGHT_DELIMITER}${prefix}`, styles: {} }
}

function restoreHighlightedTextItem(item: InlineItem): InlineItem {
  return {
    ...item,
    styles: withoutHighlightStyle(item.styles),
  }
}

function appendRestoredHighlightedItem(
  restored: InlineItem[],
  item: InlineItem,
  activeColor: MarkdownHighlightColor | null,
): MarkdownHighlightColor {
  const color = markdownHighlightColorFromStyles(item.styles) ?? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
  if (activeColor !== color) {
    if (activeColor !== null) restored.push(highlightMarker())
    restored.push(highlightMarker(markdownHighlightPrefix(color)))
  }
  restored.push(restoreHighlightedTextItem(item))
  return color
}

function appendRestoredPlainItem(
  restored: InlineItem[],
  item: InlineItem,
  activeColor: MarkdownHighlightColor | null,
): void {
  if (activeColor !== null) restored.push(highlightMarker())
  restored.push(item)
}

function restoreMarkdownHighlights(content: InlineItem[]): InlineItem[] {
  const restored: InlineItem[] = []
  let activeColor: MarkdownHighlightColor | null = null
  let changed = false

  for (const item of content) {
    if (isHighlightedTextItem(item)) {
      activeColor = appendRestoredHighlightedItem(restored, item, activeColor)
      changed = true
      continue
    }

    appendRestoredPlainItem(restored, item, activeColor)
    activeColor = null
  }

  if (activeColor !== null) restored.push(highlightMarker())
  return changed ? restored : content
}

function isTableContent(content: BlockContent): content is TableContentLike {
  return Boolean(
    content
      && typeof content === 'object'
      && !Array.isArray(content)
      && (content as TableContentLike).type === 'tableContent'
      && Array.isArray((content as TableContentLike).rows),
  )
}

function transformTableCell(cell: TableCellValue, transform: InlineContentTransform): TableCellValue {
  if (typeof cell === 'string' || !Array.isArray(cell.content)) return cell
  const content = transform(cell.content)
  return content === cell.content ? cell : { ...cell, content }
}

function transformTableContent(
  content: TableContentLike,
  transform: InlineContentTransform,
): TableContentLike {
  const rows = content.rows?.map((row) => transformTableRow(row, transform))
  if (!rows || !content.rows || rows.every((row, index) => row === content.rows?.at(index))) return content
  return {
    ...content,
    rows,
  }
}

function transformTableRow(
  row: TableRowLike,
  transform: InlineContentTransform,
): TableRowLike {
  const cells = row.cells?.map((cell) => transformTableCell(cell, transform))
  if (!cells || !row.cells || cells.every((cell, index) => cell === row.cells?.at(index))) return row
  return { ...row, cells }
}

function transformBlockContent(
  content: BlockContent,
  transform: InlineContentTransform,
): BlockContent {
  if (Array.isArray(content)) return transform(content)
  if (isTableContent(content)) return transformTableContent(content, transform)
  return content
}

function shouldTransformBlockContent(block: BlockLike): boolean {
  return block.type !== 'codeBlock'
}

function transformBlock(block: BlockLike, transform: InlineContentTransform): BlockLike {
  const content = shouldTransformBlockContent(block)
    ? transformBlockContent(block.content, transform)
    : block.content
  const children = transformChildBlocks(block.children, child => transformBlock(child, transform))
  return content === block.content && children === block.children ? block : { ...block, content, children }
}

function transformChildBlocks(
  children: BlockLike[] | undefined,
  transform: (block: BlockLike) => BlockLike,
): BlockLike[] | undefined {
  if (!Array.isArray(children)) return children
  const nextChildren = children.map(transform)
  return nextChildren.some((child, index) => child !== children.at(index)) ? nextChildren : children
}

export function injectMarkdownHighlightsInBlocks(blocks: unknown[]): unknown[] {
  return (blocks as BlockLike[]).map(block => transformBlock(block, injectMarkdownHighlights))
}

export function restoreMarkdownHighlightsInBlocks(blocks: unknown[]): unknown[] {
  return (blocks as BlockLike[]).map(block => transformBlock(block, restoreMarkdownHighlights))
}

export function serializeMarkdownHighlightAwareBlocks(
  editor: MarkdownSerializer,
  blocks: unknown[],
): string {
  return serializeBlockNoteMarkdown(editor, restoreMarkdownHighlightsInBlocks(blocks)).trimEnd()
}
