import type { ReactNode } from 'react'
import { Code, LinkSimple, TextAa, type Icon } from '@phosphor-icons/react'
import { APP_COMMAND_DEFINITIONS, APP_COMMAND_IDS } from '@/shell/app-command-catalog'
import type { EditorMode } from '@/types'
import { documentLocation } from '@/folder/explorer'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

/** Toggle Rich/Raw's shortcut as the manifest writes it (`⌘\\`): Fuwa v0.1 is a macOS app, like the sidebar toggle's `⌘[`. */
const TOGGLE_SHORTCUT = APP_COMMAND_DEFINITIONS[APP_COMMAND_IDS.editToggleRawEditor].shortcut?.display ?? ''
const COPY_PATH_SHORTCUT = APP_COMMAND_DEFINITIONS[APP_COMMAND_IDS.editCopyPath].shortcut?.display ?? ''
const MODE_LABELS: Record<EditorMode, string> = { rich: 'Rich', raw: 'Raw' }
const MODE_ICONS: Record<EditorMode, Icon> = { rich: TextAa, raw: Code }
const MODES: readonly EditorMode[] = ['rich', 'raw']

/** A Document Tab's mode, as the path row shows and switches it. */
export interface PathRowMode {
  value: EditorMode
  /** Asked for the other segment. */
  onChange: (mode: EditorMode) => void
  /** The tooltip that replaces the shortcut on the Rich segment while it is unavailable, or null when Rich can be used. */
  richDisabledReason: string | null
}

/** An Image Tab's right-hand slot: what the picture is, and the way to hand it to a real image app. */
export interface PathRowImage {
  /** `1920 × 1080 · 240 KB`, or null until the picture has loaded and there is a size to name. */
  metadata: string | null
  onOpenExternal: () => void
}

interface PathRowProps {
  /** The open Document's or Image file's name; path and Folder supply its breadcrumb. */
  filename: string
  path?: string
  folder?: string | null
  /** Set on an Image Tab. */
  image?: PathRowImage | null
  /** Set on a Document Tab: its Rich | Raw control. */
  mode?: PathRowMode | null
  /** Copy path, the app command (⌘⇧,), behind the round link button on every Tab. */
  onCopyPath?: () => void
}

/**
 * The row under the tab bar: the Document's name on the left and, on the
 * right, the round Copy path button, then the `Rich | Raw` control. A landed
 * write shows nothing here, and neither does Frontmatter: Raw mode is where
 * it is seen. An Image Tab fills that slot instead with
 * the picture's dimensions and size, Open ↗ and the same Copy path button; it
 * has no Frontmatter and no mode. Everything on the right is pill-shaped,
 * though icon buttons elsewhere in the app keep their small radius.
 */
export function PathRow({ filename, path, folder, image, mode, onCopyPath }: PathRowProps) {
  return (
    <div className="flex h-9 flex-none items-center gap-1.5 pr-3 pl-4 text-sm text-text-secondary" data-testid="path-row">
      <div className="flex min-w-0 items-center gap-1.5" data-testid="path-row-crumb">
        {path && documentLocation(path, folder).parents.map((parent, index) => (
          <span key={index}>{parent} <span aria-hidden="true">›</span> </span>
        ))}
        <span className="truncate text-text-primary">{filename}</span>
      </div>
      {/* Right-hand slot: Copy path and Rich | Raw, or an Image Tab's meta, Open ↗ and Copy path. */}
      <div className="ml-auto flex items-center gap-3">
        {image?.metadata && (
          <span className="cursor-default font-mono text-2xs tracking-normal whitespace-nowrap tabular-nums" data-testid="path-row-image-meta">{image.metadata}</span>
        )}
        <div className={cn('flex flex-none items-center gap-1.5', image && '-ml-1')} data-testid="path-row-actions">
          {/* "Open ↗": the arrow is the label, not an icon beside it. */}
          {image && <Button type="button" variant="ghost" size="xs" className="rounded-full" onClick={image.onOpenExternal}>Open ↗</Button>}
          {onCopyPath && <CopyPathButton onCopyPath={onCopyPath} />}
          {mode && <ModeControl mode={mode} />}
        </div>
      </div>
    </div>
  )
}

/** The link button: a 26px circle, its tooltip naming Copy path's shortcut as a chip. */
function CopyPathButton({ onCopyPath }: { onCopyPath: () => void }) {
  return (
    <PathRowTooltip label="Copy path" shortcut={COPY_PATH_SHORTCUT}>
      <button
        type="button"
        className="grid size-6.5 flex-none cursor-default place-items-center rounded-full text-text-secondary hover:bg-control-tertiary-hover hover:text-text-heading focus-visible:focus-ring"
        aria-label="Copy path"
        data-testid="path-row-copy-path"
        onClick={onCopyPath}
      >
        <LinkSimple size={16} aria-hidden="true" />
      </button>
    </PathRowTooltip>
  )
}

/**
 * `Rich | Raw`: a pill track on the shade surface, two icon segments (Aa for
 * Rich, </> for Raw), the current one a raised white pill, each with a
 * tooltip naming the mode and the shortcut as a chip. Invalid Frontmatter
 * leaves the Rich segment in place but unavailable, faded, its tooltip saying
 * why. It is marked with aria-disabled rather than the disabled attribute so
 * it still takes the pointer and can show that tooltip; `aria-checked` is the
 * one source of which segment is current.
 */
function ModeControl({ mode }: { mode: PathRowMode }) {
  return (
    <div className="flex h-6.5 flex-none items-center gap-0.5 rounded-full bg-surface-shade p-0.5" role="radiogroup" aria-label="Editor mode" data-testid="path-row-mode">
      {MODES.map((segment) => {
        const active = segment === mode.value
        const disabledReason = segment === 'rich' ? mode.richDisabledReason : null
        const SegmentIcon = MODE_ICONS[segment]
        return (
          <PathRowTooltip key={segment} label={disabledReason ?? MODE_LABELS[segment]} shortcut={disabledReason === null ? TOGGLE_SHORTCUT : undefined}>
            <button
              type="button"
              role="radio"
              className="grid h-5.5 w-7 cursor-default place-items-center rounded-full text-text-secondary hover:text-text-heading focus-visible:focus-ring aria-checked:bg-surface-popover aria-checked:text-text-heading aria-checked:shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] aria-disabled:text-text-muted"
              aria-label={MODE_LABELS[segment]}
              aria-checked={active}
              aria-disabled={disabledReason !== null || undefined}
              data-testid={`path-row-mode-${segment}`}
              onClick={() => {
                if (active || disabledReason !== null) return
                mode.onChange(segment)
              }}
            >
              <SegmentIcon size={15} aria-hidden="true" />
            </button>
          </PathRowTooltip>
        )
      })}
    </div>
  )
}

function PathRowTooltip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="end" shortcut={shortcut}>{label}</TooltipContent>
    </Tooltip>
  )
}
