import { useEffect, useState, type ReactNode } from 'react'
import { APP_COMMAND_DEFINITIONS, APP_COMMAND_IDS } from '@/shell/app-command-catalog'
import type { EditorMode } from '@/types'
import { documentLocation } from '@/folder/explorer'
import { formatSavedLabel } from './path-row-saved-label'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

const SAVED_LABEL_TICK_MS = 1_000
/** Toggle Rich/Raw's shortcut as the manifest writes it (`⌘\\`): Fuwa v0.1 is a macOS app, like the sidebar toggle's `⌘[`. */
const TOGGLE_SHORTCUT = APP_COMMAND_DEFINITIONS[APP_COMMAND_IDS.editToggleRawEditor].shortcut?.display ?? ''
const MODE_LABELS: Record<EditorMode, string> = { rich: 'Rich', raw: 'Raw' }
const MODES: readonly EditorMode[] = ['rich', 'raw']

/** A Document Tab's mode, as the path row shows and switches it. */
export interface PathRowMode {
  value: EditorMode
  /** Asked for the other segment, or the Frontmatter badge (which always asks for Raw). */
  onChange: (mode: EditorMode) => void
  /** The tooltip that replaces the shortcut on the Rich segment while it is unavailable, or null when Rich can be used. */
  richDisabledReason: string | null
  /** `frontmatter · N keys`, or null when the Document has no Frontmatter. */
  frontmatterLabel: string | null
}

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
  /** Set on a Document Tab: its Rich | Raw control and, when there is one, the Frontmatter badge. */
  mode?: PathRowMode | null
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
 * The row under the tab bar: the Document's name on the left and, on the
 * right in order, its save state, the mono `frontmatter · N keys` badge when
 * the Document has Frontmatter, and the `Rich | Raw` segmented control. An
 * Image Tab fills that slot instead with the picture's dimensions and size and
 * the two buttons that hand the file to a real image app; it has no save
 * state, no Frontmatter and no mode.
 */
export function PathRow({ filename, path, folder, savedAt, image, mode }: PathRowProps) {
  const savedLabel = useSavedLabel(image ? null : savedAt)

  return (
    <div className="fuwa-path-row" data-testid="path-row">
      <div className="fuwa-path-row__crumb" data-testid="path-row-crumb">
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
        {mode && <FrontmatterBadge mode={mode} />}
        {mode && <ModeControl mode={mode} />}
      </div>
    </div>
  )
}

/** The badge says Frontmatter is there and hidden; clicking it goes to where it can be seen. */
function FrontmatterBadge({ mode }: { mode: PathRowMode }) {
  if (!mode.frontmatterLabel) return null
  return (
    <button
      type="button"
      className="fuwa-path-row__frontmatter"
      data-testid="path-row-frontmatter"
      onClick={() => mode.onChange('raw')}
    >
      {mode.frontmatterLabel}
    </button>
  )
}

/**
 * `Rich | Raw`: two segments, the current one raised, each with a mono
 * tooltip naming the shortcut. Invalid Frontmatter leaves the Rich segment
 * in place but unavailable, its tooltip saying why. It is
 * marked with aria-disabled rather than the disabled attribute so it still
 * takes the pointer and can show that tooltip.
 */
function ModeControl({ mode }: { mode: PathRowMode }) {
  return (
    <div className="fuwa-mode" role="radiogroup" aria-label="Editor mode" data-testid="path-row-mode">
      {MODES.map((segment) => {
        const active = segment === mode.value
        const disabledReason = segment === 'rich' ? mode.richDisabledReason : null
        return (
          <ModeTooltip key={segment} text={disabledReason ?? `${MODE_LABELS[segment]} ${TOGGLE_SHORTCUT}`}>
            <button
              type="button"
              role="radio"
              className="fuwa-mode__segment"
              aria-checked={active}
              aria-disabled={disabledReason !== null || undefined}
              data-testid={`path-row-mode-${segment}`}
              data-active={active || undefined}
              onClick={() => {
                if (active || disabledReason !== null) return
                mode.onChange(segment)
              }}
            >
              {MODE_LABELS[segment]}
            </button>
          </ModeTooltip>
        )
      })}
    </div>
  )
}

function ModeTooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="fuwa-mode__tip">{text}</TooltipContent>
    </Tooltip>
  )
}

function ImageMeta({ image }: { image: PathRowImage }) {
  return (
    <>
      {image.metadata && (
        <span className="fuwa-path-row__image-meta" data-testid="path-row-image-meta">{image.metadata}</span>
      )}
      {/* The buttons are "Open ↗" and "Copy path"; the arrow is the label, not an icon beside it. */}
      <span className="fuwa-path-row__actions">
        <Button type="button" variant="ghost" size="xs" onClick={image.onOpenExternal}>Open ↗</Button>
        <Button type="button" variant="ghost" size="xs" onClick={image.onCopyPath}>Copy path</Button>
      </span>
    </>
  )
}
