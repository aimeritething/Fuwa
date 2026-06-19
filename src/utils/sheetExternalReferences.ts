import {
  columnIndexFromName,
  columnNameFromOneBasedIndex,
  metadataCellAddress,
} from './sheetMetadata'
import { wikilinkTarget } from './wikilink'

const MAX_SHEET_ROWS = 1048576
const MAX_SHEET_COLUMNS = 16384

export const SHEET_EXTERNAL_CELL_REFERENCE_PATTERN = /\[\[([^\]\n]+?)\]\]\.(\$?)([A-Za-z]+)(\$?)([1-9]\d*)/g

export interface SheetExternalCellReference {
  address: string
  target: string
}

interface SheetExternalCellReferenceParts {
  column: number
  columnAbsolute: boolean
  row: number
  rowAbsolute: boolean
}

function parseExternalCellReferenceParts(
  columnAbsolute: string,
  rawColumn: string,
  rowAbsolute: string,
  rawRow: string,
): SheetExternalCellReferenceParts | null {
  const column = columnIndexFromName(rawColumn)
  const row = Number.parseInt(rawRow, 10)
  if (!column || !Number.isFinite(row) || row < 1) return null
  return {
    column,
    columnAbsolute: columnAbsolute === '$',
    row,
    rowAbsolute: rowAbsolute === '$',
  }
}

export function isExternalFormulaInput(value: string): boolean {
  SHEET_EXTERNAL_CELL_REFERENCE_PATTERN.lastIndex = 0
  return value.trimStart().startsWith('=') && SHEET_EXTERNAL_CELL_REFERENCE_PATTERN.test(value)
}

export function extractSheetExternalCellReferences(value: string): SheetExternalCellReference[] {
  const references: SheetExternalCellReference[] = []
  SHEET_EXTERNAL_CELL_REFERENCE_PATTERN.lastIndex = 0
  for (const match of value.matchAll(SHEET_EXTERNAL_CELL_REFERENCE_PATTERN)) {
    const rawTarget = match[1]
    const parsed = parseExternalCellReferenceParts(match[2] ?? '', match[3] ?? '', match[4] ?? '', match[5] ?? '')
    if (!rawTarget || !parsed) continue
    references.push({
      address: metadataCellAddress(parsed.row, parsed.column),
      target: wikilinkTarget(`[[${rawTarget}]]`),
    })
  }
  return references
}

export function shiftExternalFormulaReferences(value: string, rowDelta: number, columnDelta: number): string {
  if (!isExternalFormulaInput(value)) return value

  return value.replace(
    SHEET_EXTERNAL_CELL_REFERENCE_PATTERN,
    (match, rawTarget, columnAbsolute, rawColumn, rowAbsolute, rawRow) => {
      const parsed = parseExternalCellReferenceParts(columnAbsolute, rawColumn, rowAbsolute, rawRow)
      if (!rawTarget || !parsed) return match

      const nextColumn = parsed.columnAbsolute ? parsed.column : parsed.column + columnDelta
      const nextRow = parsed.rowAbsolute ? parsed.row : parsed.row + rowDelta
      if (nextColumn < 1 || nextColumn > MAX_SHEET_COLUMNS || nextRow < 1 || nextRow > MAX_SHEET_ROWS) {
        return match
      }

      return `[[${rawTarget}]].${parsed.columnAbsolute ? '$' : ''}${columnNameFromOneBasedIndex(nextColumn)}${parsed.rowAbsolute ? '$' : ''}${nextRow}`
    },
  )
}
