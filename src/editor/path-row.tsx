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
    <div className="flex h-9 flex-none items-center gap-1.5 pr-3 pl-4 text-sm text-text-secondary" data-testid="path-row">
      <div className="flex min-w-0 items-center gap-1.5" data-testid="path-row-crumb">
        {path && documentLocation(path, folder).parents.map((parent, index) => (
          <span key={index}>{parent} <span aria-hidden="true">›</span> </span>
        ))}
        <span className="truncate text-text-primary">{filename}</span>
      </div>
      {/* Right-hand slot: saved time, then the Frontmatter badge and Rich | Raw, or an Image Tab's meta and actions. */}
      <div className="ml-auto flex items-center gap-3">
        {savedLabel && (
          <span className="cursor-default font-mono text-2xs tracking-normal tabular-nums" data-testid="path-row-saved">{savedLabel}</span>
        )}
        {image && <ImageMeta image={image} />}
        {mode && <FrontmatterBadge mode={mode} />}
        {mode && <ModeControl mode={mode} />}
      </div>
    </div>
  )
}

/**
 * The badge says Frontmatter is there and hidden; clicking it goes to where it
 * can be seen. A mono hairline pill in the saved label's colour, a button and
 * not a Badge: hovering says it can be clicked, which lands in Raw mode.
 */
function FrontmatterBadge({ mode }: { mode: PathRowMode }) {
  if (!mode.frontmatterLabel) return null
  return (
    <button
      type="button"
      className="h-5 flex-none cursor-default rounded-md px-1.75 font-mono text-2xs leading-5 tracking-normal whitespace-nowrap tabular-nums text-text-secondary ring-(length:--hairline) ring-border-default hover:bg-control-tertiary-hover hover:text-text-primary focus-visible:focus-ring"
      data-testid="path-row-frontmatter"
      onClick={() => mode.onChange('raw')}
    >
      {mode.frontmatterLabel}
    </button>
  )
}

/**
 * `Rich | Raw`: a hairline-ringed track on the shade surface, two segments,
 * the current one raised like the active tab, each with a tooltip naming the
 * shortcut as a chip. Invalid Frontmatter leaves the Rich segment in place
 * but unavailable, faded, its tooltip saying why. It is marked with
 * aria-disabled rather than the disabled attribute so it still takes the
 * pointer and can show that tooltip; `aria-checked` is the one source of
 * which segment is current.
 */
function ModeControl({ mode }: { mode: PathRowMode }) {
  return (
    <div className="flex h-5.5 flex-none items-center gap-0.5 rounded-md bg-surface-shade p-0.5 ring-(length:--hairline) ring-border-default" role="radiogroup" aria-label="Editor mode" data-testid="path-row-mode">
      {MODES.map((segment) => {
        const active = segment === mode.value
        const disabledReason = segment === 'rich' ? mode.richDisabledReason : null
        return (
          <ModeTooltip key={segment} label={disabledReason ?? MODE_LABELS[segment]} shortcut={disabledReason === null ? TOGGLE_SHORTCUT : undefined}>
            <button
              type="button"
              role="radio"
              className="h-4.5 cursor-default rounded-sm px-2 text-xs leading-4.5 font-medium tracking-[-0.01em] text-text-secondary hover:text-text-heading focus-visible:focus-ring aria-checked:bg-tab-active aria-checked:text-text-heading aria-checked:shadow-raised aria-disabled:text-text-muted"
              aria-checked={active}
              aria-disabled={disabledReason !== null || undefined}
              data-testid={`path-row-mode-${segment}`}
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

function ModeTooltip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="end" shortcut={shortcut}>{label}</TooltipContent>
    </Tooltip>
  )
}

function ImageMeta({ image }: { image: PathRowImage }) {
  return (
    <>
      {image.metadata && (
        <span className="cursor-default font-mono text-2xs tracking-normal whitespace-nowrap tabular-nums" data-testid="path-row-image-meta">{image.metadata}</span>
      )}
      {/* The buttons are "Open ↗" and "Copy path"; the arrow is the label, not an icon beside it. */}
      <span className="-ml-1 flex flex-none items-center gap-0.5">
        <Button type="button" variant="ghost" size="xs" onClick={image.onOpenExternal}>Open ↗</Button>
        <Button type="button" variant="ghost" size="xs" onClick={image.onCopyPath}>Copy path</Button>
      </span>
    </>
  )
}
