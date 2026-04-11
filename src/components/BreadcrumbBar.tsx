import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { VaultEntry } from '../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  MagnifyingGlass,
  GitBranch,
  Code,
  CursorText,
  Sparkle,
  SlidersHorizontal,
  DotsThree,
  Trash,
  Archive,
  ArrowUUpLeft,
  Star,
  CheckCircle,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { NoteTitleIcon } from './NoteTitleIcon'
import { slugify } from '../hooks/useNoteCreation'

interface BreadcrumbBarProps {
  entry: VaultEntry
  wordCount: number
  showDiffToggle: boolean
  diffMode: boolean
  diffLoading: boolean
  onToggleDiff: () => void
  rawMode?: boolean
  onToggleRaw?: () => void
  /** When true, raw mode is forced (non-markdown file) — hide the toggle. */
  forceRawMode?: boolean
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed?: boolean
  onToggleInspector?: () => void
  onToggleFavorite?: () => void
  onToggleOrganized?: () => void
  onDelete?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  /** Ref for direct DOM manipulation — avoids re-render on scroll. */
  barRef?: React.Ref<HTMLDivElement>
}

const DISABLED_ICON_STYLE = { opacity: 0.4, cursor: 'not-allowed' } as const
const BREADCRUMB_ICON_CLASS = 'size-[16px]'

function focusFilenameInput(
  isEditing: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  if (!isEditing) return
  inputRef.current?.focus()
  inputRef.current?.select()
}

function beginFilenameEditing(
  onRenameFilename: BreadcrumbBarProps['onRenameFilename'],
  filenameStem: string,
  setDraftStem: (value: string) => void,
  setIsEditing: (value: boolean) => void,
) {
  if (!onRenameFilename) return
  setDraftStem(filenameStem)
  setIsEditing(true)
}

function resolveFilenameRenameTarget(draftStem: string, filenameStem: string): string | null {
  const nextStem = normalizeFilenameStemInput(draftStem)
  if (!nextStem || nextStem === filenameStem) return null
  return nextStem
}

function handleFilenameInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  submitRename: () => void,
  cancelEditing: () => void,
) {
  switch (event.key) {
    case 'Enter':
      event.preventDefault()
      submitRename()
      return
    case 'Escape':
      event.preventDefault()
      cancelEditing()
      return
    default:
      return
  }
}

function IconActionButton({
  title,
  onClick,
  className,
  style,
  disabled,
  tabIndex,
  children,
  testId,
}: {
  title: string
  onClick?: () => void
  className?: string
  style?: CSSProperties
  disabled?: boolean
  tabIndex?: number
  children: ReactNode
  testId?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn('text-muted-foreground [&_svg:not([class*=size-])]:size-4', className)}
      style={style}
      onClick={onClick}
      disabled={disabled}
      tabIndex={tabIndex}
      title={title}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}

function RawToggleButton({ rawMode, onToggleRaw }: { rawMode?: boolean; onToggleRaw?: () => void }) {
  return (
    <IconActionButton
      title={rawMode ? 'Back to editor' : 'Raw editor'}
      onClick={onToggleRaw}
      className={cn(rawMode ? 'text-foreground' : 'hover:text-foreground')}
    >
      <Code size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function FavoriteAction({ favorite, onToggleFavorite }: { favorite: boolean; onToggleFavorite?: () => void }) {
  return (
    <IconActionButton
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={onToggleFavorite}
      className={cn(favorite ? 'text-yellow-500' : 'hover:text-foreground')}
    >
      <Star size={16} weight={favorite ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function OrganizedAction({
  organized,
  onToggleOrganized,
}: {
  organized: boolean
  onToggleOrganized?: () => void
}) {
  if (!onToggleOrganized) return null
  return (
    <IconActionButton
      title={organized ? 'Mark as unorganized (back to Inbox) (Cmd+E)' : 'Mark as organized (remove from Inbox) (Cmd+E)'}
      onClick={onToggleOrganized}
      className={cn(organized ? 'text-green-600' : 'hover:text-foreground')}
    >
      <CheckCircle size={16} weight={organized ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function SearchAction() {
  return (
    <IconActionButton title="Search in file" className="hover:text-foreground">
      <MagnifyingGlass size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function DiffAction({
  showDiffToggle,
  diffMode,
  diffLoading,
  onToggleDiff,
}: Pick<BreadcrumbBarProps, 'showDiffToggle' | 'diffMode' | 'diffLoading' | 'onToggleDiff'>) {
  if (!showDiffToggle) {
    return (
      <IconActionButton title="No changes" style={DISABLED_ICON_STYLE} tabIndex={-1}>
        <GitBranch size={16} className={BREADCRUMB_ICON_CLASS} />
      </IconActionButton>
    )
  }

  return (
    <IconActionButton
      title={diffLoading ? 'Loading diff...' : diffMode ? 'Back to editor' : 'Show diff'}
      onClick={onToggleDiff}
      disabled={diffLoading}
      className={cn(diffMode ? 'text-foreground' : 'hover:text-foreground')}
    >
      <GitBranch size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function PlaceholderAction({ title, children }: { title: string; children: ReactNode }) {
  return (
    <IconActionButton title={title} style={DISABLED_ICON_STYLE} tabIndex={-1}>
      {children}
    </IconActionButton>
  )
}

function AIChatAction({ showAIChat, onToggleAIChat }: Pick<BreadcrumbBarProps, 'showAIChat' | 'onToggleAIChat'>) {
  return (
    <IconActionButton
      title={showAIChat ? 'Close AI Chat' : 'Open AI Chat'}
      onClick={onToggleAIChat}
      className={cn(showAIChat ? 'text-primary' : 'hover:text-foreground')}
    >
      <Sparkle size={16} weight={showAIChat ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function ArchiveAction({
  archived,
  onArchive,
  onUnarchive,
}: Pick<VaultEntry, 'archived'> & Pick<BreadcrumbBarProps, 'onArchive' | 'onUnarchive'>) {
  if (archived) {
    return (
      <IconActionButton title="Unarchive" onClick={onUnarchive} className="hover:text-foreground">
        <ArrowUUpLeft size={16} className={BREADCRUMB_ICON_CLASS} />
      </IconActionButton>
    )
  }

  return (
    <IconActionButton title="Archive" onClick={onArchive} className="hover:text-foreground">
      <Archive size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function DeleteAction({ onDelete }: Pick<BreadcrumbBarProps, 'onDelete'>) {
  return (
    <IconActionButton title="Delete (Cmd+Delete)" onClick={onDelete} className="hover:text-destructive">
      <Trash size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function InspectorAction({
  inspectorCollapsed,
  onToggleInspector,
}: Pick<BreadcrumbBarProps, 'inspectorCollapsed' | 'onToggleInspector'>) {
  if (!inspectorCollapsed) return null
  return (
    <IconActionButton title="Properties (⌘⇧I)" onClick={onToggleInspector} className="hover:text-foreground">
      <SlidersHorizontal size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function normalizeFilenameStemInput(value: string): string {
  const trimmed = value.trim()
  return trimmed.replace(/\.md$/i, '').trim()
}

function deriveSyncStem(entry: VaultEntry): string | null {
  const expectedStem = slugify(entry.title.trim())
  const filenameStem = entry.filename.replace(/\.md$/, '')
  if (!expectedStem || expectedStem === filenameStem) return null
  return expectedStem
}

function FilenameInput({
  inputRef,
  draftStem,
  onDraftStemChange,
  onBlur,
  onKeyDown,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  draftStem: string
  onDraftStemChange: (nextValue: string) => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <Input
      ref={inputRef}
      value={draftStem}
      onChange={(event) => onDraftStemChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-7 w-[180px] text-sm"
      data-testid="breadcrumb-filename-input"
      aria-label="Rename filename"
    />
  )
}

function FilenameTrigger({
  entry,
  filenameStem,
  onStartEditing,
}: {
  entry: VaultEntry
  filenameStem: string
  onStartEditing: () => void
}) {
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    onStartEditing()
  }, [onStartEditing])

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="h-auto min-w-0 gap-1 px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
      onDoubleClick={onStartEditing}
      onKeyDown={handleKeyDown}
      data-testid="breadcrumb-filename-trigger"
      aria-label={`Filename ${filenameStem}. Press Enter to rename`}
    >
      <NoteTitleIcon icon={entry.icon} size={15} testId="breadcrumb-note-icon" />
      <span className="truncate">{filenameStem}</span>
    </Button>
  )
}

function SyncFilenameButton({
  entryPath,
  syncStem,
  onRenameFilename,
}: {
  entryPath: string
  syncStem: string | null
  onRenameFilename?: (path: string, newFilenameStem: string) => void
}) {
  if (!syncStem || !onRenameFilename) return null
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onRenameFilename(entryPath, syncStem)}
            data-testid="breadcrumb-sync-button"
            aria-label="Rename file to match title"
          >
            <ArrowsClockwise size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Rename file to match title
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function FilenameDisplay({
  entry,
  filenameStem,
  syncStem,
  onRenameFilename,
  onStartEditing,
}: {
  entry: VaultEntry
  filenameStem: string
  syncStem: string | null
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  onStartEditing: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <FilenameTrigger entry={entry} filenameStem={filenameStem} onStartEditing={onStartEditing} />
      <SyncFilenameButton entryPath={entry.path} syncStem={syncStem} onRenameFilename={onRenameFilename} />
    </div>
  )
}

function FilenameCrumb({ entry, onRenameFilename }: Pick<BreadcrumbBarProps, 'entry' | 'onRenameFilename'>) {
  const filenameStem = useMemo(() => entry.filename.replace(/\.md$/, ''), [entry.filename])
  const syncStem = useMemo(() => deriveSyncStem(entry), [entry])
  const [isEditing, setIsEditing] = useState(false)
  const [draftStem, setDraftStem] = useState(filenameStem)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    focusFilenameInput(isEditing, inputRef)
  }, [isEditing])

  const startEditing = useCallback(() => {
    beginFilenameEditing(onRenameFilename, filenameStem, setDraftStem, setIsEditing)
  }, [onRenameFilename, filenameStem])

  const cancelEditing = useCallback(() => {
    setDraftStem(filenameStem)
    setIsEditing(false)
  }, [filenameStem])

  const submitRename = useCallback(() => {
    setIsEditing(false)
    const nextStem = resolveFilenameRenameTarget(draftStem, filenameStem)
    if (!nextStem) return
    onRenameFilename?.(entry.path, nextStem)
  }, [draftStem, filenameStem, onRenameFilename, entry.path])

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    handleFilenameInputKeyDown(event, submitRename, cancelEditing)
  }, [submitRename, cancelEditing])

  if (isEditing) {
    return (
      <FilenameInput
        inputRef={inputRef}
        draftStem={draftStem}
        onDraftStemChange={setDraftStem}
        onBlur={submitRename}
        onKeyDown={handleInputKeyDown}
      />
    )
  }

  return (
    <FilenameDisplay
      entry={entry}
      filenameStem={filenameStem}
      syncStem={syncStem}
      onRenameFilename={onRenameFilename}
      onStartEditing={startEditing}
    />
  )
}

function BreadcrumbActions({
  entry,
  showDiffToggle,
  diffMode,
  diffLoading,
  onToggleDiff,
  rawMode,
  onToggleRaw,
  forceRawMode,
  showAIChat,
  onToggleAIChat,
  inspectorCollapsed,
  onToggleInspector,
  onToggleFavorite,
  onToggleOrganized,
  onDelete,
  onArchive,
  onUnarchive,
}: Omit<BreadcrumbBarProps, 'wordCount' | 'barRef' | 'onRenameFilename'>) {
  return (
    <div className="breadcrumb-bar__actions ml-auto flex items-center" style={{ gap: 12 }}>
      <FavoriteAction favorite={entry.favorite} onToggleFavorite={onToggleFavorite} />
      <OrganizedAction organized={entry.organized} onToggleOrganized={onToggleOrganized} />
      <SearchAction />
      <DiffAction
        showDiffToggle={showDiffToggle}
        diffMode={diffMode}
        diffLoading={diffLoading}
        onToggleDiff={onToggleDiff}
      />
      {!forceRawMode && <RawToggleButton rawMode={rawMode} onToggleRaw={onToggleRaw} />}
      <PlaceholderAction title="Coming soon">
        <CursorText size={16} className={BREADCRUMB_ICON_CLASS} />
      </PlaceholderAction>
      <AIChatAction showAIChat={showAIChat} onToggleAIChat={onToggleAIChat} />
      <ArchiveAction archived={entry.archived} onArchive={onArchive} onUnarchive={onUnarchive} />
      <DeleteAction onDelete={onDelete} />
      <InspectorAction inspectorCollapsed={inspectorCollapsed} onToggleInspector={onToggleInspector} />
      <PlaceholderAction title="Coming soon">
        <DotsThree size={16} className={BREADCRUMB_ICON_CLASS} />
      </PlaceholderAction>
    </div>
  )
}

function BreadcrumbTitle({
  entry,
  onRenameFilename,
}: Pick<BreadcrumbBarProps, 'entry' | 'onRenameFilename'>) {
  const typeLabel = entry.isA ?? 'Note'
  return (
    <div className="flex items-center gap-1.5 min-w-0 text-sm text-muted-foreground">
      <span className="shrink-0">{typeLabel}</span>
      <span className="shrink-0 text-border">›</span>
      <div className="flex min-w-0 items-center gap-1 truncate">
        <FilenameCrumb entry={entry} onRenameFilename={onRenameFilename} />
      </div>
    </div>
  )
}

export const BreadcrumbBar = memo(function BreadcrumbBar({
  entry,
  barRef,
  onRenameFilename,
  ...actionProps
}: BreadcrumbBarProps) {
  return (
    <div
      ref={barRef}
      data-tauri-drag-region
      data-title-hidden=""
      className="breadcrumb-bar flex shrink-0 items-center border-b border-transparent"
      style={{
        height: 52,
        background: 'var(--background)',
        padding: '6px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div className="breadcrumb-bar__title min-w-0">
        <BreadcrumbTitle entry={entry} onRenameFilename={onRenameFilename} />
      </div>
      <div
        aria-hidden="true"
        data-tauri-drag-region
        className="breadcrumb-bar__drag-spacer min-w-0 flex-1"
      />
      <BreadcrumbActions entry={entry} {...actionProps} />
    </div>
  )
})
