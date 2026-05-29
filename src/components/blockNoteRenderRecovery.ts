const BLOCKNOTE_MISSING_ID_ERROR = "Block doesn't have id"
const BLOCKNOTE_RECOVERY_BOUNDARY_NAME = 'BlockNoteRenderRecoveryBoundary'
const RECOVERED_BLOCKNOTE_RENDER_ERROR_MARK = '__tolariaRecoveredBlockNoteRenderError'
const BLOCKNOTE_TABLE_ROW_INDEX_ERROR = /^Index \d+ out of range for <tableRow\(/

export type BlockNoteRenderRecoveryReason =
  | 'block_missing_id'
  | 'table_row_index_out_of_range'

type MarkedRecoveredBlockNoteRenderError = Error & {
  [RECOVERED_BLOCKNOTE_RENDER_ERROR_MARK]?: true
}

function hasRecoveredRenderErrorMark(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return Reflect.get(error as MarkedRecoveredBlockNoteRenderError, RECOVERED_BLOCKNOTE_RENDER_ERROR_MARK) === true
}

export function isRecoverableBlockNoteRenderError(error: unknown): boolean {
  return blockNoteRenderRecoveryReason(error) !== null
}

export function blockNoteRenderRecoveryReason(error: unknown): BlockNoteRenderRecoveryReason | null {
  if (!(error instanceof Error)) return null
  if (error.message.includes(BLOCKNOTE_MISSING_ID_ERROR)) return 'block_missing_id'
  if (error instanceof RangeError && BLOCKNOTE_TABLE_ROW_INDEX_ERROR.test(error.message)) {
    return 'table_row_index_out_of_range'
  }

  return null
}

export function markRecoveredBlockNoteRenderError(error: unknown): void {
  if (!isRecoverableBlockNoteRenderError(error)) return
  const markedError = error as MarkedRecoveredBlockNoteRenderError
  Reflect.set(markedError, RECOVERED_BLOCKNOTE_RENDER_ERROR_MARK, true)
}

export function isRecoveredBlockNoteRenderError(
  error: unknown,
  componentStack: string,
): boolean {
  return isRecoverableBlockNoteRenderError(error)
    && (
      hasRecoveredRenderErrorMark(error)
      || componentStack.includes(BLOCKNOTE_RECOVERY_BOUNDARY_NAME)
    )
}
