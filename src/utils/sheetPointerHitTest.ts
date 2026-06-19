import type { Model } from '@ironcalc/workbook'

const MAX_SHEET_ROWS = 1048576
const MAX_SHEET_COLUMNS = 16384
const ROW_HEADER_WIDTH_PX = 30
const COLUMN_HEADER_HEIGHT_PX = 28
const FROZEN_SEPARATOR_WIDTH_PX = 3

function sheetColumnWidth(model: Model, sheet: number, column: number): number {
  return Math.round(model.getColumnWidth(sheet, column))
}

function sheetRowHeight(model: Model, sheet: number, row: number): number {
  return Math.round(model.getRowHeight(sheet, row))
}

function frozenColumnWidth(model: Model, sheet: number, frozenColumns: number): number {
  if (frozenColumns === 0) return 0

  let width = 0
  for (let column = 1; column <= frozenColumns; column += 1) {
    width += sheetColumnWidth(model, sheet, column)
  }
  return width + FROZEN_SEPARATOR_WIDTH_PX
}

function frozenRowHeight(model: Model, sheet: number, frozenRows: number): number {
  if (frozenRows === 0) return 0

  let height = 0
  for (let row = 1; row <= frozenRows; row += 1) {
    height += sheetRowHeight(model, sheet, row)
  }
  return height + FROZEN_SEPARATOR_WIDTH_PX
}

function indexAtOffset(
  offset: number,
  startIndex: number,
  maxIndex: number,
  sizeAtIndex: (index: number) => number,
): number | null {
  if (offset < 0) return null

  let cursor = 0
  for (let index = startIndex; index <= maxIndex; index += 1) {
    cursor += sizeAtIndex(index)
    if (offset < cursor) return index
  }
  return null
}

function sheetColumnAtCanvasX(model: Model, sheet: number, x: number): number | null {
  if (x < ROW_HEADER_WIDTH_PX) return null

  const view = model.getSelectedView()
  const frozenColumns = model.getFrozenColumnsCount(sheet)
  const frozenWidth = frozenColumnWidth(model, sheet, frozenColumns)
  const cellX = x - ROW_HEADER_WIDTH_PX

  if (frozenColumns > 0 && cellX < frozenWidth) {
    return indexAtOffset(cellX, 1, frozenColumns, (column) => sheetColumnWidth(model, sheet, column))
  }

  const firstVisibleColumn = Math.max(frozenColumns + 1, view.left_column)
  return indexAtOffset(
    cellX - frozenWidth,
    firstVisibleColumn,
    MAX_SHEET_COLUMNS,
    (column) => sheetColumnWidth(model, sheet, column),
  )
}

function sheetRowAtCanvasY(model: Model, sheet: number, y: number): number | null {
  if (y < COLUMN_HEADER_HEIGHT_PX) return null

  const view = model.getSelectedView()
  const frozenRows = model.getFrozenRowsCount(sheet)
  const frozenHeight = frozenRowHeight(model, sheet, frozenRows)
  const cellY = y - COLUMN_HEADER_HEIGHT_PX

  if (frozenRows > 0 && cellY < frozenHeight) {
    return indexAtOffset(cellY, 1, frozenRows, (row) => sheetRowHeight(model, sheet, row))
  }

  const firstVisibleRow = Math.max(frozenRows + 1, view.top_row)
  return indexAtOffset(
    cellY - frozenHeight,
    firstVisibleRow,
    MAX_SHEET_ROWS,
    (row) => sheetRowHeight(model, sheet, row),
  )
}

export function sheetCellFromCanvasPoint(
  model: Model,
  sheet: number,
  x: number,
  y: number,
): { column: number; row: number } | null {
  const column = sheetColumnAtCanvasX(model, sheet, x)
  const row = sheetRowAtCanvasY(model, sheet, y)
  return row && column ? { column, row } : null
}
