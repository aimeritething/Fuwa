export interface SheetDocumentParts {
  frontmatter: string
  body: string
}

export interface ParsedCsvRows {
  rawRows: string[]
  rowTerminators: string[]
  rows: string[][]
}

const FRONTMATTER_OPEN = '---'
const FRONTMATTER_DELIMITER_RE = /^---[ \t]*$/m

function firstLineBreakLength(content: string, index: number): number {
  if (content[index] === '\r' && content[index + 1] === '\n') return 2
  if (content[index] === '\n' || content[index] === '\r') return 1
  return 0
}

export function splitSheetDocument(content: string): SheetDocumentParts {
  if (!content.startsWith(FRONTMATTER_OPEN)) return { frontmatter: '', body: content }

  const openingLineBreak = firstLineBreakLength(content, FRONTMATTER_OPEN.length)
  if (openingLineBreak === 0) return { frontmatter: '', body: content }

  const searchStart = FRONTMATTER_OPEN.length + openingLineBreak
  const rest = content.slice(searchStart)
  const closeMatch = rest.match(FRONTMATTER_DELIMITER_RE)
  if (!closeMatch || closeMatch.index === undefined) return { frontmatter: '', body: content }

  const closeStart = searchStart + closeMatch.index
  const closeEnd = closeStart + closeMatch[0].length
  const closingLineBreak = firstLineBreakLength(content, closeEnd)
  const bodyStart = closeEnd + closingLineBreak

  return {
    frontmatter: content.slice(0, bodyStart),
    body: content.slice(bodyStart),
  }
}

export function mergeSheetDocument(frontmatter: string, body: string): string {
  return `${frontmatter}${body}`
}

export function parseCsvRowsWithSource(source: string): ParsedCsvRows {
  if (source.length === 0) return { rawRows: [], rowTerminators: [], rows: [] }

  const rows: string[][] = []
  const rawRows: string[] = []
  const rowTerminators: string[] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let rowStart = 0

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"' && cell.length === 0) {
      quoted = true
      continue
    }

    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (char === '\n' || char === '\r') {
      const rowTerminator = char === '\r' && next === '\n' ? '\r\n' : char
      row.push(cell)
      rows.push(row)
      rawRows.push(source.slice(rowStart, index))
      rowTerminators.push(rowTerminator)
      row = []
      cell = ''
      if (char === '\r' && next === '\n') index += 1
      rowStart = index + 1
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0 || source.endsWith(',')) {
    row.push(cell)
    rows.push(row)
    rawRows.push(source.slice(rowStart))
    rowTerminators.push('')
  }

  return { rawRows, rowTerminators, rows }
}

export function parseCsvRows(source: string): string[][] {
  return parseCsvRowsWithSource(source).rows
}

function shouldQuoteCsvCell(value: string): boolean {
  return value.includes(',')
    || value.includes('"')
    || value.includes('\n')
    || value.includes('\r')
    || value !== value.trim()
}

function serializeCsvCell(value: string): string {
  if (!shouldQuoteCsvCell(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

function lastMeaningfulRowIndex(rows: string[][]): number {
  for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
    if (rows[rowIndex]?.some((cell) => cell !== '') === true) return rowIndex
  }
  return -1
}

function lastMeaningfulColumnIndex(row: string[]): number {
  for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex -= 1) {
    if (row[columnIndex] !== '') {
      return columnIndex
    }
  }
  return -1
}

function serializeCsvRow(row: string[], minimumWidth = 0): string {
  const lastColumn = lastMeaningfulColumnIndex(row)
  const columnCount = Math.max(lastColumn + 1, minimumWidth)
  if (columnCount <= 0) return ''

  return row
    .slice(0, columnCount)
    .map((cell) => serializeCsvCell(cell ?? ''))
    .join(',')
}

export function serializeCsvRows(rows: string[][]): string {
  const lastRow = lastMeaningfulRowIndex(rows)
  if (lastRow < 0) return ''

  return rows.slice(0, lastRow + 1)
    .map((row) => serializeCsvRow(row))
    .join('\n')
}

function csvRowsEqual(left: string[] | undefined, right: string[] | undefined): boolean {
  const leftCells = left ?? []
  const rightCells = right ?? []
  if (leftCells.length !== rightCells.length) return false
  return leftCells.every((cell, index) => cell === rightCells[index])
}

export function serializeCsvRowsPreservingSourceRows(rows: string[][], source: string): string {
  return serializeCsvRowsPreservingParsedSourceRows(rows, parseCsvRowsWithSource(source))
}

function sourceRowTerminator(parsedSource: ParsedCsvRows): string {
  return parsedSource.rowTerminators.find((terminator) => terminator !== '') ?? '\n'
}

export function serializeCsvRowsPreservingParsedSourceRows(rows: string[][], parsedSource: ParsedCsvRows): string {
  const lastRow = Math.max(lastMeaningfulRowIndex(rows), parsedSource.rows.length - 1)
  if (lastRow < 0) return ''
  const rowTerminator = sourceRowTerminator(parsedSource)

  return Array.from({ length: lastRow + 1 }, (_, rowIndex) => {
    const row = rows[rowIndex] ?? []
    const serializedRow = csvRowsEqual(row, parsedSource.rows[rowIndex])
      ? parsedSource.rawRows[rowIndex] ?? ''
      : serializeCsvRow(row, parsedSource.rows[rowIndex]?.length ?? 0)
    const terminator = parsedSource.rowTerminators[rowIndex] ?? (rowIndex < lastRow ? rowTerminator : '')
    return `${serializedRow}${terminator}`
  }).join('')
}

export function serializeCsvRowsReplacingParsedSourceRows(
  parsedSource: ParsedCsvRows,
  replacements: Map<number, string[]>,
): string {
  if (replacements.size === 0) {
    return parsedSource.rawRows.map((row, index) => `${row}${parsedSource.rowTerminators[index] ?? ''}`).join('')
  }

  const lastReplacementRow = Math.max(...replacements.keys())
  const lastRow = Math.max(parsedSource.rows.length - 1, lastReplacementRow)
  if (lastRow < 0) return ''
  const rowTerminator = sourceRowTerminator(parsedSource)

  return Array.from({ length: lastRow + 1 }, (_, rowIndex) => {
    const replacement = replacements.get(rowIndex)
    const serializedRow = replacement && !csvRowsEqual(replacement, parsedSource.rows[rowIndex])
      ? serializeCsvRow(replacement, parsedSource.rows[rowIndex]?.length ?? 0)
      : parsedSource.rawRows[rowIndex] ?? ''
    const terminator = parsedSource.rowTerminators[rowIndex] ?? (rowIndex < lastRow ? rowTerminator : '')
    return `${serializedRow}${terminator}`
  }).join('')
}

export function columnNameFromIndex(index: number): string {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

export function cellAddress(rowIndex: number, columnIndex: number): string {
  return `${columnNameFromIndex(columnIndex)}${rowIndex + 1}`
}
