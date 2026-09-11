import { useEffect, useState } from 'react'
import { documentLocation } from '../utils/explorer'
import { formatSavedLabel } from './pathRowSavedLabel'
import { Button } from './ui/button'

const SAVED_LABEL_TICK_MS = 1_000

/** An Image Tab's right-hand slot: what the picture is, and the two ways to hand it on. */
export interface PathRowImage {
  /** `1920 × 1080 · 240 KB`, or null until the picture has loaded and there is a size to name. */
  metadata: string | null
  onOpenExternal: () => void
  onCopyPath: () => void
}

interface PathRowProps {
  /** The open Document's or Image file's name; path and Folder supply its breadcrumb. */
  filename: string
  path?: string
  folder?: string | null
  /** When the last write landed on disk, or null before the first one. */
  savedAt: number | null
  /** Set on an Image Tab, which is never written and so has no save state to show. */
  image?: PathRowImage | null
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
 * The row under the tab bar: the Document's name on the left, its
 * save state on the right. The right-hand slot is a flex row so the Frontmatter
 * badge and the Rich | Raw control (AIM-381) append to it without relayout.
 * An Image Tab (AIM-388) fills that slot instead with the picture's
 * dimensions and size and the two buttons that hand the file to a real image
 * app; it has no save state, no Frontmatter and no mode.
 */
export function PathRow({ filename, path, folder, savedAt, image }: PathRowProps) {
  const savedLabel = useSavedLabel(image ? null : savedAt)

  return (
    <div className="fuwa-path-row" data-testid="path-row">
      <div className="fuwa-path-row__crumb">
        {path && documentLocation(path, folder).parents.map((parent, index) => (
          <span className="fuwa-path-row__parent" key={index}>{parent} <span aria-hidden="true">›</span> </span>
        ))}
        <span className="fuwa-path-row__name">{filename}</span>
      </div>
      <div className="fuwa-path-row__meta">
        {savedLabel && (
          <span className="fuwa-path-row__saved" data-testid="path-row-saved">{savedLabel}</span>
        )}
        {image && <ImageMeta image={image} />}
      </div>
    </div>
  )
}

function ImageMeta({ image }: { image: PathRowImage }) {
  return (
    <>
      {image.metadata && (
        <span className="fuwa-path-row__image-meta" data-testid="path-row-image-meta">{image.metadata}</span>
      )}
      {/* The spec names the buttons "Open ↗" and "Copy path"; the arrow is the label, not an icon beside it. */}
      <span className="fuwa-path-row__actions">
        <Button type="button" variant="ghost" size="xs" onClick={image.onOpenExternal}>Open ↗</Button>
        <Button type="button" variant="ghost" size="xs" onClick={image.onCopyPath}>Copy path</Button>
      </span>
    </>
  )
}
