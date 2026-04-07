import type React from 'react'
import { useCallback, useRef, useEffect } from 'react'
import type { VaultEntry, NoteStatus } from '../types'
import type { useCreateBlockNote } from '@blocknote/react'
import { DiffView } from './DiffView'
import { BreadcrumbBar } from './BreadcrumbBar'
import { TitleField } from './TitleField'
import { NoteIcon } from './NoteIcon'
import { ArchivedNoteBanner } from './ArchivedNoteBanner'
import { ConflictNoteBanner } from './ConflictNoteBanner'
import { RawEditorView } from './RawEditorView'
import { countWords } from '../utils/wikilinks'
import { SingleEditorView } from './SingleEditorView'
import { isEmoji } from '../utils/emoji'
import { useEditorTheme } from '../hooks/useTheme'

interface Tab {
  entry: VaultEntry
  content: string
}

interface EditorContentProps {
  activeTab: Tab | null
  isLoadingNewTab: boolean
  entries: VaultEntry[]
  editor: ReturnType<typeof useCreateBlockNote>
  diffMode: boolean
  diffContent: string | null
  diffLoading: boolean
  onToggleDiff: () => void
  rawMode: boolean
  onToggleRaw: () => void
  onRawContentChange?: (path: string, content: string) => void
  onSave?: () => void
  activeStatus: NoteStatus
  showDiffToggle: boolean
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed: boolean
  onToggleInspector: () => void
  onNavigateWikilink: (target: string) => void
  onEditorChange?: () => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onDeleteNote?: (path: string) => void
  onArchiveNote?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
  vaultPath?: string
  /** Ref updated by RawEditorView on every keystroke with the latest doc. */
  rawLatestContentRef?: React.MutableRefObject<string | null>
  /** Called when the user edits the dedicated title field. */
  onTitleChange?: (path: string, newTitle: string) => void
  /** Called when user sets or changes an emoji icon via the picker. */
  onSetNoteIcon?: (path: string, emoji: string) => void
  /** Called when user removes an emoji icon. */
  onRemoveNoteIcon?: (path: string) => void
  /** Whether the active note has a merge conflict. */
  isConflicted?: boolean
  /** Resolve conflict by keeping the local version. */
  onKeepMine?: (path: string) => void
  /** Resolve conflict by keeping the remote version. */
  onKeepTheirs?: (path: string) => void
}

function EditorLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-8 animate-pulse" style={{ minHeight: 0 }}>
      <div className="h-6 w-2/5 rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-4 w-3/5 rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-4 w-2/5 rounded bg-muted" />
    </div>
  )
}

function DiffModeView({ diffContent, onToggleDiff }: { diffContent: string | null; onToggleDiff: () => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <button
        className="flex items-center gap-1.5 px-4 py-2 text-xs text-primary bg-muted border-b border-border cursor-pointer hover:bg-accent transition-colors w-full border-t-0 border-l-0 border-r-0"
        onClick={onToggleDiff}
        title="Back to editor"
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span>
        Back to editor
      </button>
      <DiffView diff={diffContent ?? ''} />
    </div>
  )
}

function RawModeEditorSection({
  rawMode, activeTab, entries, onContentChange, onSave, latestContentRef, vaultPath,
}: {
  rawMode: boolean
  activeTab: Tab | null
  entries: VaultEntry[]
  onContentChange?: (path: string, content: string) => void
  onSave?: () => void
  latestContentRef?: React.MutableRefObject<string | null>
  vaultPath?: string
}) {
  if (!rawMode || !activeTab) return null
  return (
    <RawEditorView
      key={activeTab.entry.path}
      content={activeTab.content}
      path={activeTab.entry.path}
      entries={entries}
      onContentChange={onContentChange ?? (() => {})}
      onSave={onSave ?? (() => {})}
      latestContentRef={latestContentRef}
      vaultPath={vaultPath}
    />
  )
}

/** Bind an optional callback to a path, returning undefined if callback is absent */
function bindPath(cb: ((path: string) => void) | undefined, path: string) {
  return cb ? () => cb(path) : undefined
}

function ActiveTabBreadcrumb({ activeTab, barRef, props }: {
  activeTab: Tab
  barRef: React.RefObject<HTMLDivElement | null>
  props: Omit<EditorContentProps, 'activeTab' | 'isLoadingNewTab' | 'entries' | 'editor' | 'onNavigateWikilink' | 'onEditorChange' | 'onRawContentChange' | 'onSave' | 'activeStatus'> & { forceRawMode?: boolean }
}) {
  const wordCount = countWords(activeTab.content)
  const path = activeTab.entry.path
  return (
    <BreadcrumbBar
      entry={activeTab.entry}
      wordCount={wordCount}
      barRef={barRef}
      showDiffToggle={props.showDiffToggle}
      diffMode={props.diffMode}
      diffLoading={props.diffLoading}
      onToggleDiff={props.onToggleDiff}
      rawMode={props.rawMode}
      onToggleRaw={props.onToggleRaw}
      forceRawMode={props.forceRawMode}
      showAIChat={props.showAIChat}
      onToggleAIChat={props.onToggleAIChat}
      inspectorCollapsed={props.inspectorCollapsed}
      onToggleInspector={props.onToggleInspector}
      onToggleFavorite={bindPath(props.onToggleFavorite, path)}
      onToggleOrganized={bindPath(props.onToggleOrganized, path)}
      onDelete={bindPath(props.onDeleteNote, path)}
      onArchive={bindPath(props.onArchiveNote, path)}
      onUnarchive={bindPath(props.onUnarchiveNote, path)}
    />
  )
}

export function EditorContent({
  activeTab, isLoadingNewTab, entries, editor,
  diffMode, diffContent, onToggleDiff,
  rawMode, onToggleRaw, onRawContentChange, onSave,
  activeStatus,
  onNavigateWikilink, onEditorChange, vaultPath,
  rawLatestContentRef, onTitleChange,
  onSetNoteIcon, onRemoveNoteIcon,
  isConflicted, onKeepMine, onKeepTheirs,
  ...breadcrumbProps
}: EditorContentProps) {
  const { cssVars } = useEditorTheme()
  const freshEntry = activeTab ? entries.find(e => e.path === activeTab.entry.path) : undefined
  const isArchived = freshEntry?.archived ?? activeTab?.entry.archived ?? false
  const hasH1 = freshEntry?.hasH1 ?? activeTab?.entry.hasH1 ?? false
  // Non-markdown text files always use the raw editor (no BlockNote)
  const isNonMarkdownText = activeTab?.entry.fileKind === 'text'
  const effectiveRawMode = rawMode || isNonMarkdownText
  const showEditor = !diffMode && !effectiveRawMode
  const entryIcon = activeTab?.entry.icon ?? null
  const emojiIcon = entryIcon && isEmoji(entryIcon) ? entryIcon : null
  const isUntitledDraft = !!activeTab
    && activeTab.entry.filename.startsWith('untitled-')
    && (activeStatus === 'new' || activeStatus === 'unsaved' || activeStatus === 'pendingSave')
  const showTitleSection = !hasH1 && !isUntitledDraft

  const titleSectionRef = useRef<HTMLDivElement | null>(null)
  const breadcrumbBarRef = useRef<HTMLDivElement | null>(null)

  // When in normal editor mode: use IntersectionObserver to show/hide the breadcrumb title
  // based on whether the title section has scrolled out of view.
  // In raw/diff mode, BreadcrumbBar handles title visibility via its rawMode/diffMode props.
  useEffect(() => {
    if (!showEditor) return

    const bar = breadcrumbBarRef.current
    const el = titleSectionRef.current
    if (!bar || !el) return

    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) bar.removeAttribute('data-title-hidden')
        else bar.setAttribute('data-title-hidden', '')
      },
      { threshold: 0 },
    )
    observer.observe(el)
    return () => { observer.disconnect(); bar.removeAttribute('data-title-hidden') }
  }, [activeTab?.entry.path, showEditor])

  const handleSetIcon = useCallback((emoji: string) => {
    if (activeTab) onSetNoteIcon?.(activeTab.entry.path, emoji)
  }, [activeTab, onSetNoteIcon])

  const handleRemoveIcon = useCallback(() => {
    if (activeTab) onRemoveNoteIcon?.(activeTab.entry.path)
  }, [activeTab, onRemoveNoteIcon])

  if (!activeTab) {
    return <div className="flex flex-1 flex-col min-w-0 min-h-0" />
  }

  const path = activeTab.entry.path

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      <ActiveTabBreadcrumb
        activeTab={activeTab}
        barRef={breadcrumbBarRef}
        props={{ diffMode, diffContent, onToggleDiff, rawMode: effectiveRawMode, onToggleRaw, forceRawMode: isNonMarkdownText, ...breadcrumbProps }}
      />
      {isArchived && breadcrumbProps.onUnarchiveNote && (
        <ArchivedNoteBanner onUnarchive={() => breadcrumbProps.onUnarchiveNote!(path)} />
      )}
      {isConflicted && (
        <ConflictNoteBanner
          onKeepMine={() => onKeepMine?.(path)}
          onKeepTheirs={() => onKeepTheirs?.(path)}
        />
      )}
      {diffMode && <DiffModeView diffContent={diffContent} onToggleDiff={onToggleDiff} />}
      <RawModeEditorSection rawMode={effectiveRawMode} activeTab={activeTab} entries={entries} onContentChange={onRawContentChange} onSave={onSave} latestContentRef={rawLatestContentRef} vaultPath={vaultPath} />
      {showEditor && (
        <div className="editor-scroll-area" style={cssVars as React.CSSProperties}>
          <div className="editor-content-wrapper">
            <div ref={titleSectionRef} className="title-section" data-title-ui-visible={showTitleSection || undefined}>
              {showTitleSection && (
                <>
                  {!emojiIcon && (
                    <div className="title-section__add-icon">
                      <NoteIcon icon={null} editable onSetIcon={handleSetIcon} onRemoveIcon={handleRemoveIcon} />
                    </div>
                  )}
                  <div className={`title-section__row${emojiIcon ? '' : ' title-section__row--no-icon'}`}>
                    {emojiIcon && (
                      <NoteIcon icon={emojiIcon} editable onSetIcon={handleSetIcon} onRemoveIcon={handleRemoveIcon} />
                    )}
                    <TitleField
                      title={activeTab.entry.title}
                      filename={activeTab.entry.filename}
                      editable
                      notePath={path}
                      vaultPath={vaultPath}
                      onTitleChange={(newTitle) => onTitleChange?.(path, newTitle)}
                    />
                  </div>
                  <div className="title-section__separator" />
                </>
              )}
            </div>
            <SingleEditorView editor={editor} entries={entries} onNavigateWikilink={onNavigateWikilink} onChange={onEditorChange} vaultPath={vaultPath} editable />
          </div>
        </div>
      )}
      {isLoadingNewTab && showEditor && <EditorLoadingSkeleton />}
    </div>
  )
}
