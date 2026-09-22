const TOOLTIP_RECOVERY_BOUNDARY_NAME = 'TooltipBoundary'
const RECOVERED_TOOLTIP_ERROR_MARK = '__plumoRecoveredTooltipError'

type MarkedRecoveredTooltipError = Error & {
  [RECOVERED_TOOLTIP_ERROR_MARK]?: true
}

function hasRecoveredTooltipMark(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return Reflect.get(error as MarkedRecoveredTooltipError, RECOVERED_TOOLTIP_ERROR_MARK) === true
}

export function markRecoveredTooltipError(error: unknown): void {
  if (!(error instanceof Error)) return
  Reflect.set(error as MarkedRecoveredTooltipError, RECOVERED_TOOLTIP_ERROR_MARK, true)
}

export function isRecoveredTooltipError(error: unknown, componentStack = ''): boolean {
  return hasRecoveredTooltipMark(error)
    || componentStack.includes(TOOLTIP_RECOVERY_BOUNDARY_NAME)
}
