const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS

/**
 * The path row's save state: `saved 2s ago`, re-rendered as time passes. The
 * timestamp is the moment the last write landed on disk, so the label only
 * ever moves after a successful save.
 */
export function formatSavedLabel(savedAt: number, now: number): string {
  const elapsed = Math.max(0, now - savedAt)
  if (elapsed < SECOND_MS) return 'saved just now'
  if (elapsed < MINUTE_MS) return `saved ${Math.floor(elapsed / SECOND_MS)}s ago`
  if (elapsed < HOUR_MS) return `saved ${Math.floor(elapsed / MINUTE_MS)}m ago`
  return `saved ${Math.floor(elapsed / HOUR_MS)}h ago`
}
