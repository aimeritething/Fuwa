import type { NoteStatus, VaultEntry } from '../../types'
import { contentDefinesDisplayTitle, extractH1TitleFromContent } from '../../utils/noteTitle'
import { countWords } from '../../utils/wikilinks'

export interface EditorContentTab {
  entry: VaultEntry
  content: string
}

interface EditorContentStateInput {
  activeTab: EditorContentTab | null
  entries: VaultEntry[]
  rawMode: boolean
  activeStatus: NoteStatus
}

interface TitleSectionState {
  hasDisplayTitle: boolean
  hasH1: boolean
}

interface VisibilityState {
  effectiveRawMode: boolean
  isDeletedPreview: boolean
  isNonMarkdownText: boolean
  showEditor: boolean
  showTitleSection: boolean
}

export interface EditorContentState {
  freshEntry: VaultEntry | undefined
  isArchived: boolean
  hasH1: boolean
  isDeletedPreview: boolean
  isNonMarkdownText: boolean
  effectiveRawMode: boolean
  showEditor: boolean
  showTitleSection: boolean
  path: string
  wordCount: number
}

function findFreshEntry(activeTab: EditorContentTab | null, entries: VaultEntry[]): VaultEntry | undefined {
  if (!activeTab) return undefined
  return entries.find((entry) => entry.path === activeTab.entry.path)
}

function contentHasTopLevelH1(activeTab: EditorContentTab | null): boolean {
  return activeTab ? extractH1TitleFromContent(activeTab.content) !== null : false
}

function contentDefinesTitle(activeTab: EditorContentTab | null): boolean {
  return activeTab ? contentDefinesDisplayTitle(activeTab.content) : false
}

function resolveHasH1(activeTab: EditorContentTab | null, freshEntry: VaultEntry | undefined): boolean {
  return contentHasTopLevelH1(activeTab) || freshEntry?.hasH1 === true || activeTab?.entry.hasH1 === true
}

function resolveHasDisplayTitle(activeTab: EditorContentTab | null, hasH1: boolean): boolean {
  return hasH1 || contentDefinesTitle(activeTab)
}

function deriveTitleSectionState(activeTab: EditorContentTab | null, freshEntry: VaultEntry | undefined): TitleSectionState {
  const hasH1 = resolveHasH1(activeTab, freshEntry)
  return {
    hasDisplayTitle: resolveHasDisplayTitle(activeTab, hasH1),
    hasH1,
  }
}

function deriveVisibilityState(input: {
  activeStatus: NoteStatus
  activeTab: EditorContentTab | null
  freshEntry: VaultEntry | undefined
  hasDisplayTitle: boolean
  rawMode: boolean
}): VisibilityState {
  const {
    activeStatus,
    activeTab,
    freshEntry,
    hasDisplayTitle,
    rawMode,
  } = input
  const isDeletedPreview = !!activeTab && !freshEntry
  const isNonMarkdownText = activeTab?.entry.fileKind === 'text'
  const effectiveRawMode = rawMode || isNonMarkdownText

  return {
    isDeletedPreview,
    isNonMarkdownText,
    effectiveRawMode,
    showEditor: !effectiveRawMode,
    showTitleSection: !isDeletedPreview && !hasDisplayTitle && !isUnsavedUntitledDraft(activeTab, activeStatus),
  }
}

function isUnsavedUntitledDraft(activeTab: EditorContentTab | null, activeStatus: NoteStatus): boolean {
  if (!activeTab) return false
  if (!activeTab.entry.filename.startsWith('untitled-')) return false
  return activeStatus === 'new' || activeStatus === 'unsaved' || activeStatus === 'pendingSave'
}

export function deriveEditorContentState({
  activeTab,
  entries,
  rawMode,
  activeStatus,
}: EditorContentStateInput): EditorContentState {
  const freshEntry = findFreshEntry(activeTab, entries)
  const titleState = deriveTitleSectionState(activeTab, freshEntry)
  const visibilityState = deriveVisibilityState({
    activeStatus,
    activeTab,
    freshEntry,
    hasDisplayTitle: titleState.hasDisplayTitle,
    rawMode,
  })

  return {
    freshEntry,
    isArchived: freshEntry?.archived ?? activeTab?.entry.archived ?? false,
    hasH1: titleState.hasH1,
    ...visibilityState,
    path: activeTab?.entry.path ?? '',
    wordCount: activeTab ? countWords(activeTab.content) : 0,
  }
}
