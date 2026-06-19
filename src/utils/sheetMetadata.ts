import { cellAddress, columnNameFromIndex } from './sheetCsv'

export interface SheetColumnMetadata {
  width?: number
}

export interface SheetRowMetadata {
  height?: number
}

export interface SheetBorderMetadata {
  color?: string
  style: string
}

export interface SheetCellMetadata {
  numFmt?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  fontSize?: number
  fontColor?: string
  fillColor?: string
  horizontalAlign?: string
  verticalAlign?: string
  wrapText?: boolean
  borderTop?: SheetBorderMetadata
  borderRight?: SheetBorderMetadata
  borderBottom?: SheetBorderMetadata
  borderLeft?: SheetBorderMetadata
}

export interface SheetMetadata {
  frozenColumns?: number
  frozenRows?: number
  showGridLines?: boolean
  columns: Record<string, SheetColumnMetadata>
  rows: Record<string, SheetRowMetadata>
  cells: Record<string, SheetCellMetadata>
}

type MetadataSection = 'columns' | 'rows' | 'cells'
type MetadataValue = string | number | boolean

const SHEET_METADATA_KEY = '_sheet'

export function emptySheetMetadata(): SheetMetadata {
  return { columns: {}, rows: {}, cells: {} }
}

export function isSheetMetadataEmpty(metadata: SheetMetadata): boolean {
  return metadata.showGridLines === undefined
    && metadata.frozenRows === undefined
    && metadata.frozenColumns === undefined
    && Object.keys(metadata.columns).length === 0
    && Object.keys(metadata.rows).length === 0
    && Object.keys(metadata.cells).length === 0
}

export function columnIndexFromName(name: string): number | null {
  const normalized = name.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(normalized)) return null

  let value = 0
  for (const char of normalized) {
    value = value * 26 + char.charCodeAt(0) - 64
  }
  return value
}

export function normalizeCellAddress(address: string): string | null {
  const match = address.trim().toUpperCase().match(/^([A-Z]+)([1-9]\d*)$/)
  if (!match) return null
  return `${match[1]}${match[2]}`
}

export function cellAddressToIndexes(address: string): { row: number; column: number } | null {
  const normalized = normalizeCellAddress(address)
  if (!normalized) return null

  const match = normalized.match(/^([A-Z]+)([1-9]\d*)$/)
  if (!match) return null

  const column = columnIndexFromName(match[1])
  if (column === null) return null

  return { row: Number(match[2]), column }
}

export function metadataCellAddress(row: number, column: number): string {
  return cellAddress(row - 1, column - 1)
}

function parseScalar(value: string): MetadataValue {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

function scalarString(value: string | number | boolean): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function parseBorderMetadata(value: MetadataValue): SheetBorderMetadata | null {
  if (typeof value !== 'string') return null
  const [style, color] = value.trim().split(/\s+/, 2)
  if (!style) return null
  return color ? { color, style } : { style }
}

function borderMetadataString(value: SheetBorderMetadata): string {
  return value.color ? `${value.style} ${value.color}` : value.style
}

function metadataPropertyName(source: string): string {
  const trimmed = source.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return String(parseScalar(trimmed))
  }
  return trimmed
}

function assignColumnMetadata(metadata: SheetMetadata, key: string, property: string, value: MetadataValue): void {
  if (property !== 'width' || typeof value !== 'number') return
  const column = key.toUpperCase()
  if (columnIndexFromName(column) === null) return
  metadata.columns[column] = { ...metadata.columns[column], width: value }
}

function assignRowMetadata(metadata: SheetMetadata, key: string, property: string, value: MetadataValue): void {
  if (property !== 'height' || typeof value !== 'number') return
  if (!/^[1-9]\d*$/.test(key)) return
  metadata.rows[key] = { ...metadata.rows[key], height: value }
}

function assignCellMetadata(metadata: SheetMetadata, key: string, property: string, value: MetadataValue): void {
  const cell = normalizeCellAddress(key)
  if (!cell) return

  const current = metadata.cells[cell] ?? {}
  if (property === 'num_fmt' && typeof value === 'string') metadata.cells[cell] = { ...current, numFmt: value }
  if (property === 'bold' && typeof value === 'boolean') metadata.cells[cell] = { ...current, bold: value }
  if (property === 'italic' && typeof value === 'boolean') metadata.cells[cell] = { ...current, italic: value }
  if (property === 'underline' && typeof value === 'boolean') metadata.cells[cell] = { ...current, underline: value }
  if (property === 'strike' && typeof value === 'boolean') metadata.cells[cell] = { ...current, strike: value }
  if (property === 'font_size' && typeof value === 'number') metadata.cells[cell] = { ...current, fontSize: value }
  if (property === 'font_color' && typeof value === 'string') metadata.cells[cell] = { ...current, fontColor: value }
  if (property === 'fill_color' && typeof value === 'string') metadata.cells[cell] = { ...current, fillColor: value }
  if (property === 'horizontal_align' && typeof value === 'string') {
    metadata.cells[cell] = { ...current, horizontalAlign: value }
  }
  if (property === 'vertical_align' && typeof value === 'string') {
    metadata.cells[cell] = { ...current, verticalAlign: value }
  }
  if (property === 'wrap_text' && typeof value === 'boolean') metadata.cells[cell] = { ...current, wrapText: value }
  if (property === 'border_top') {
    const border = parseBorderMetadata(value)
    if (border) metadata.cells[cell] = { ...current, borderTop: border }
  }
  if (property === 'border_right') {
    const border = parseBorderMetadata(value)
    if (border) metadata.cells[cell] = { ...current, borderRight: border }
  }
  if (property === 'border_bottom') {
    const border = parseBorderMetadata(value)
    if (border) metadata.cells[cell] = { ...current, borderBottom: border }
  }
  if (property === 'border_left') {
    const border = parseBorderMetadata(value)
    if (border) metadata.cells[cell] = { ...current, borderLeft: border }
  }
}

function assignSheetSetting(metadata: SheetMetadata, property: string, value: MetadataValue): void {
  if (property === 'show_grid_lines' && typeof value === 'boolean') metadata.showGridLines = value
  if (property === 'frozen_rows' && typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    metadata.frozenRows = value
  }
  if (property === 'frozen_columns' && typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    metadata.frozenColumns = value
  }
}

function assignMetadataValue(
  metadata: SheetMetadata,
  section: MetadataSection,
  key: string,
  property: string,
  value: MetadataValue,
): void {
  if (section === 'columns') assignColumnMetadata(metadata, key, property, value)
  if (section === 'rows') assignRowMetadata(metadata, key, property, value)
  if (section === 'cells') assignCellMetadata(metadata, key, property, value)
}

export function parseSheetMetadata(frontmatter: string): SheetMetadata {
  const metadata = emptySheetMetadata()
  const lines = frontmatter.replace(/\r\n/g, '\n').split('\n')
  const startIndex = lines.findIndex((line) => line.trim() === `${SHEET_METADATA_KEY}:`)
  if (startIndex < 0) return metadata

  let section: MetadataSection | null = null
  let key: string | null = null

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (line.trim() === '') continue
    if (!line.startsWith(' ')) break

    const sectionMatch = line.match(/^ {2}(columns|rows|cells):\s*$/)
    if (sectionMatch) {
      section = sectionMatch[1] as MetadataSection
      key = null
      continue
    }

    const sheetSettingMatch = line.match(/^ {2}([A-Za-z_]+):\s*(.+)$/)
    if (sheetSettingMatch) {
      assignSheetSetting(metadata, metadataPropertyName(sheetSettingMatch[1]), parseScalar(sheetSettingMatch[2]))
      section = null
      key = null
      continue
    }

    const keyMatch = line.match(/^ {4}([^:]+):\s*$/)
    if (keyMatch) {
      key = metadataPropertyName(keyMatch[1])
      continue
    }

    const valueMatch = line.match(/^ {6}([^:]+):\s*(.*)$/)
    if (!valueMatch || !section || !key) continue
    assignMetadataValue(metadata, section, key, metadataPropertyName(valueMatch[1]), parseScalar(valueMatch[2]))
  }

  return metadata
}

function metadataBlockLines(metadata: SheetMetadata): string[] {
  const lines = [`${SHEET_METADATA_KEY}:`]

  if (metadata.showGridLines !== undefined) {
    lines.push(`  show_grid_lines: ${scalarString(metadata.showGridLines)}`)
  }
  if (metadata.frozenRows !== undefined) {
    lines.push(`  frozen_rows: ${scalarString(metadata.frozenRows)}`)
  }
  if (metadata.frozenColumns !== undefined) {
    lines.push(`  frozen_columns: ${scalarString(metadata.frozenColumns)}`)
  }

  const columnEntries = Object.entries(metadata.columns)
    .filter(([, value]) => value.width !== undefined)
    .sort(([left], [right]) => (columnIndexFromName(left) ?? 0) - (columnIndexFromName(right) ?? 0))
  if (columnEntries.length > 0) {
    lines.push('  columns:')
    for (const [column, value] of columnEntries) {
      lines.push(`    ${column}:`)
      if (value.width !== undefined) lines.push(`      width: ${scalarString(value.width)}`)
    }
  }

  const rowEntries = Object.entries(metadata.rows)
    .filter(([, value]) => value.height !== undefined)
    .sort(([left], [right]) => Number(left) - Number(right))
  if (rowEntries.length > 0) {
    lines.push('  rows:')
    for (const [row, value] of rowEntries) {
      lines.push(`    "${row}":`)
      if (value.height !== undefined) lines.push(`      height: ${scalarString(value.height)}`)
    }
  }

  const cellEntries = Object.entries(metadata.cells)
    .filter(([, value]) => Object.keys(value).length > 0)
    .sort(([left], [right]) => {
      const leftIndexes = cellAddressToIndexes(left)
      const rightIndexes = cellAddressToIndexes(right)
      if (!leftIndexes || !rightIndexes) return left.localeCompare(right)
      return leftIndexes.row === rightIndexes.row
        ? leftIndexes.column - rightIndexes.column
        : leftIndexes.row - rightIndexes.row
    })
  if (cellEntries.length > 0) {
    lines.push('  cells:')
    for (const [cell, value] of cellEntries) {
      lines.push(`    ${cell}:`)
      if (value.numFmt !== undefined) lines.push(`      num_fmt: ${scalarString(value.numFmt)}`)
      if (value.bold !== undefined) lines.push(`      bold: ${scalarString(value.bold)}`)
      if (value.italic !== undefined) lines.push(`      italic: ${scalarString(value.italic)}`)
      if (value.underline !== undefined) lines.push(`      underline: ${scalarString(value.underline)}`)
      if (value.strike !== undefined) lines.push(`      strike: ${scalarString(value.strike)}`)
      if (value.fontSize !== undefined) lines.push(`      font_size: ${scalarString(value.fontSize)}`)
      if (value.fontColor !== undefined) lines.push(`      font_color: ${scalarString(value.fontColor)}`)
      if (value.fillColor !== undefined) lines.push(`      fill_color: ${scalarString(value.fillColor)}`)
      if (value.horizontalAlign !== undefined) {
        lines.push(`      horizontal_align: ${scalarString(value.horizontalAlign)}`)
      }
      if (value.verticalAlign !== undefined) {
        lines.push(`      vertical_align: ${scalarString(value.verticalAlign)}`)
      }
      if (value.wrapText !== undefined) lines.push(`      wrap_text: ${scalarString(value.wrapText)}`)
      if (value.borderTop !== undefined) lines.push(`      border_top: ${scalarString(borderMetadataString(value.borderTop))}`)
      if (value.borderRight !== undefined) {
        lines.push(`      border_right: ${scalarString(borderMetadataString(value.borderRight))}`)
      }
      if (value.borderBottom !== undefined) {
        lines.push(`      border_bottom: ${scalarString(borderMetadataString(value.borderBottom))}`)
      }
      if (value.borderLeft !== undefined) {
        lines.push(`      border_left: ${scalarString(borderMetadataString(value.borderLeft))}`)
      }
    }
  }

  return lines
}

function removeExistingMetadataBlock(lines: string[]): string[] {
  const startIndex = lines.findIndex((line) => line.trim() === `${SHEET_METADATA_KEY}:`)
  if (startIndex < 0) return lines

  let endIndex = startIndex + 1
  while (endIndex < lines.length) {
    const line = lines[endIndex] ?? ''
    if (line.trim() !== '' && !line.startsWith(' ')) break
    endIndex += 1
  }

  return [...lines.slice(0, startIndex), ...lines.slice(endIndex)]
}

export function mergeSheetMetadata(frontmatter: string, metadata: SheetMetadata): string {
  if (!frontmatter.startsWith('---')) return frontmatter

  const lineEnding = frontmatter.includes('\r\n') ? '\r\n' : '\n'
  const normalized = frontmatter.replace(/\r\n/g, '\n')
  const hasTrailingLineBreak = normalized.endsWith('\n')
  const lines = removeExistingMetadataBlock(normalized.split('\n'))
  const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (closeIndex < 0) return frontmatter

  if (!isSheetMetadataEmpty(metadata)) {
    lines.splice(closeIndex, 0, ...metadataBlockLines(metadata))
  }

  const merged = lines.join(lineEnding)
  return hasTrailingLineBreak && !merged.endsWith(lineEnding) ? `${merged}${lineEnding}` : merged
}

export function columnNameFromOneBasedIndex(column: number): string {
  return columnNameFromIndex(column - 1)
}
