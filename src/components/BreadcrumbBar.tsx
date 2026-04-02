import { memo } from 'react'
import type { VaultEntry } from '../types'
import { cn } from '@/lib/utils'
import {
  MagnifyingGlass,
  GitBranch,
  Code,
  CursorText,
  Sparkle,
  SlidersHorizontal,
  DotsThree,
  Trash,
  ArrowCounterClockwise,
  Archive,
  ArrowUUpLeft,
  Star,
} from '@phosphor-icons/react'

interface BreadcrumbBarProps {
  entry: VaultEntry
  wordCount: number
  showDiffToggle: boolean
  diffMode: boolean
  diffLoading: boolean
  onToggleDiff: () => void
  rawMode?: boolean
  onToggleRaw?: () => void
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed?: boolean
  onToggleInspector?: () => void
  onToggleFavorite?: () => void
  onTrash?: () => void
  onRestore?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  /** Ref for direct DOM manipulation — avoids re-render on scroll. */
  barRef?: React.Ref<HTMLDivElement>
}

const DISABLED_ICON_STYLE = { opacity: 0.4, cursor: 'not-allowed' } as const

function RawToggleButton({ rawMode, onToggleRaw }: { rawMode?: boolean; onToggleRaw?: () => void }) {
  return (
    <button
      className={cn(
        'flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors',
        rawMode ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onToggleRaw}
      title={rawMode ? 'Back to editor' : 'Raw editor'}
    >
      <Code size={16} />
    </button>
  )
}

function BreadcrumbActions({ entry, showDiffToggle, diffMode, diffLoading, onToggleDiff,
  rawMode, onToggleRaw,
  showAIChat, onToggleAIChat, inspectorCollapsed, onToggleInspector,
  onToggleFavorite, onTrash, onRestore, onArchive, onUnarchive,
}: Omit<BreadcrumbBarProps, 'wordCount'>) {
  return (
    <div className="flex items-center" style={{ gap: 12 }}>
      <button
        className={cn(
          "flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors",
          entry.favorite ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={onToggleFavorite}
        title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star size={16} weight={entry.favorite ? 'fill' : 'regular'} />
      </button>
      <button
        className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        title="Search in file"
      >
        <MagnifyingGlass size={16} />
      </button>
      {showDiffToggle ? (
        <button
          className={cn(
            "flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors",
            diffMode ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={onToggleDiff}
          disabled={diffLoading}
          title={diffLoading ? 'Loading diff...' : diffMode ? 'Back to editor' : 'Show diff'}
        >
          <GitBranch size={16} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
          style={DISABLED_ICON_STYLE}
          title="No changes"
          tabIndex={-1}
        >
          <GitBranch size={16} />
        </button>
      )}
      <RawToggleButton rawMode={rawMode} onToggleRaw={onToggleRaw} />
      <button
        className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
        style={DISABLED_ICON_STYLE}
        title="Coming soon"
        tabIndex={-1}
      >
        <CursorText size={16} />
      </button>
      <button
        className={cn(
          "flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors",
          showAIChat ? "" : "text-muted-foreground hover:text-foreground"
        )}
        style={showAIChat ? { color: 'var(--primary)' } : undefined}
        onClick={onToggleAIChat}
        title={showAIChat ? 'Close AI Chat' : 'Open AI Chat'}
      >
        <Sparkle size={16} weight={showAIChat ? 'fill' : 'regular'} />
      </button>
      {entry.archived ? (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          onClick={onUnarchive}
          title="Unarchive (Cmd+E)"
        >
          <ArrowUUpLeft size={16} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          onClick={onArchive}
          title="Archive (Cmd+E)"
        >
          <Archive size={16} />
        </button>
      )}
      {entry.trashed ? (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          onClick={onRestore}
          title="Restore from trash"
        >
          <ArrowCounterClockwise size={16} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-destructive"
          onClick={onTrash}
          title="Move to trash (Cmd+Delete)"
        >
          <Trash size={16} />
        </button>
      )}
      {inspectorCollapsed && (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={onToggleInspector}
          title="Properties (⌘⇧I)"
        >
          <SlidersHorizontal size={16} />
        </button>
      )}
      <button
        className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
        style={DISABLED_ICON_STYLE}
        title="Coming soon"
        tabIndex={-1}
      >
        <DotsThree size={16} />
      </button>
    </div>
  )
}

function BreadcrumbTitle({ entry }: { entry: VaultEntry }) {
  const typeLabel = entry.isA ?? 'Note'
  const icon = entry.icon
  const emojiIcon = icon && /^\p{Emoji}/u.test(icon) ? icon : null
  return (
    <div className="flex items-center gap-1.5 min-w-0 text-sm text-muted-foreground">
      <span className="shrink-0">{typeLabel}</span>
      <span className="shrink-0 text-border">›</span>
      {emojiIcon && <span className="shrink-0">{emojiIcon}</span>}
      <span className="truncate font-medium text-foreground">{entry.title}</span>
    </div>
  )
}

export const BreadcrumbBar = memo(function BreadcrumbBar({
  entry, barRef, ...actionProps
}: BreadcrumbBarProps) {
  return (
    <div
      ref={barRef}
      data-tauri-drag-region
      className="breadcrumb-bar flex shrink-0 items-center"
      style={{
        height: 52,
        background: 'var(--background)',
        padding: '6px 16px',
      }}
    >
      <div className="breadcrumb-bar__title flex-1 min-w-0">
        <BreadcrumbTitle entry={entry} />
      </div>
      <BreadcrumbActions entry={entry} {...actionProps} />
    </div>
  )
})
