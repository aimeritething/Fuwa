import { useEffect, useState } from 'react'
import { formatSavedLabel } from './pathRowSavedLabel'

const SAVED_LABEL_TICK_MS = 1_000

interface PathRowProps {
  /** The open Document's file name. The full breadcrumb arrives with the Folder (AIM-383). */
  filename: string
  /** When the last write landed on disk, or null before the first one. */
  savedAt: number | null
}

/** A clock that advances once a second while a save time is on show. */
function useSavedLabel(savedAt: number | null): string | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (savedAt === null) return
    const timer = window.setInterval(() => setNow(Date.now()), SAVED_LABEL_TICK_MS)
    return () => window.clearInterval(timer)
  }, [savedAt])

  if (savedAt === null) return null
  return formatSavedLabel(savedAt, Math.max(now, savedAt))
}

/**
 * The row under the (future) tab bar: the Document's name on the left, its
 * save state on the right. The right-hand slot is a flex row so the Frontmatter
 * badge and the Rich | Raw control (AIM-381) append to it without relayout.
 */
export function PathRow({ filename, savedAt }: PathRowProps) {
  const savedLabel = useSavedLabel(savedAt)

  return (
    <div className="fuwa-path-row" data-testid="path-row">
      <div className="fuwa-path-row__crumb">
        <span className="fuwa-path-row__name">{filename}</span>
      </div>
      <div className="fuwa-path-row__meta">
        {savedLabel && (
          <span className="fuwa-path-row__saved" data-testid="path-row-saved">{savedLabel}</span>
        )}
      </div>
    </div>
  )
}
