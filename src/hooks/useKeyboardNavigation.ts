import { useEffect, useMemo, useRef } from 'react'
import { isTauri } from '../mock-tauri'
import { filterEntries, sortByModified, buildRelationshipGroups } from '../utils/noteListHelpers'
import type { VaultEntry, SidebarSelection } from '../types'

interface Tab {
  entry: VaultEntry
  content: string
}

interface KeyboardNavigationOptions {
  tabs: Tab[]
  activeTabPath: string | null
  entries: VaultEntry[]
  selection: SidebarSelection
  onSwitchTab: (path: string) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onSelectNote: (entry: VaultEntry) => void
}

function computeVisibleNotes(
  entries: VaultEntry[],
  selection: SidebarSelection,
): VaultEntry[] {
  if (selection.kind === 'entity') {
    return buildRelationshipGroups(selection.entry, entries)
      .flatMap((g) => g.entries)
  }
  return [...filterEntries(entries, selection)].sort(sortByModified)
}

function navigateTab(
  tabsRef: React.RefObject<Tab[]>,
  activeTabPathRef: React.RefObject<string | null>,
  onSwitchTab: React.RefObject<(path: string) => void>,
  direction: 1 | -1,
) {
  const currentTabs = tabsRef.current!
  if (currentTabs.length === 0) return

  const currentPath = activeTabPathRef.current
  const currentIndex = currentTabs.findIndex((t) => t.entry.path === currentPath)
  const nextIndex = (currentIndex + direction + currentTabs.length) % currentTabs.length
  onSwitchTab.current!(currentTabs[nextIndex].entry.path)
}

function navigateNote(
  visibleNotesRef: React.RefObject<VaultEntry[]>,
  activeTabPathRef: React.RefObject<string | null>,
  onReplace: React.RefObject<(entry: VaultEntry) => void>,
  onSelect: React.RefObject<(entry: VaultEntry) => void>,
  direction: 1 | -1,
) {
  const notes = visibleNotesRef.current!
  if (notes.length === 0) return

  const currentPath = activeTabPathRef.current
  const currentIndex = notes.findIndex((n) => n.path === currentPath)

  const nextIndex = currentIndex === -1
    ? (direction === 1 ? 0 : notes.length - 1)
    : (currentIndex + direction + notes.length) % notes.length

  const nextNote = notes[nextIndex]
  if (currentPath) {
    onReplace.current!(nextNote)
  } else {
    onSelect.current!(nextNote)
  }
}

type ShortcutKind = 'tab' | 'note' | null

function classifyShortcut(e: KeyboardEvent, inTauri: boolean): ShortcutKind {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return null
  const isTabShortcut = inTauri ? (e.altKey && !e.shiftKey) : (e.shiftKey && !e.altKey)
  if (isTabShortcut && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return 'tab'
  if (e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return 'note'
  return null
}

function arrowDirection(key: string): 1 | -1 {
  return (key === 'ArrowRight' || key === 'ArrowDown') ? 1 : -1
}

function useLatestRef<T>(value: T): React.RefObject<T> {
  const ref = useRef(value)
  useEffect(() => { ref.current = value })
  return ref
}

export function useKeyboardNavigation({
  tabs, activeTabPath, entries, selection,
  onSwitchTab, onReplaceActiveTab, onSelectNote,
}: KeyboardNavigationOptions) {
  const visibleNotes = useMemo(
    () => computeVisibleNotes(entries, selection),
    [entries, selection],
  )

  const tabsRef = useLatestRef(tabs)
  const activeTabPathRef = useLatestRef(activeTabPath)
  const visibleNotesRef = useLatestRef(visibleNotes)
  const onSwitchTabRef = useLatestRef(onSwitchTab)
  const onReplaceRef = useLatestRef(onReplaceActiveTab)
  const onSelectNoteRef = useLatestRef(onSelectNote)

  useEffect(() => {
    const inTauri = isTauri()
    const handleKeyDown = (e: KeyboardEvent) => {
      const kind = classifyShortcut(e, inTauri)
      if (!kind) return
      e.preventDefault()
      if (kind === 'tab') navigateTab(tabsRef, activeTabPathRef, onSwitchTabRef, arrowDirection(e.key))
      else navigateNote(visibleNotesRef, activeTabPathRef, onReplaceRef, onSelectNoteRef, arrowDirection(e.key))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabsRef, activeTabPathRef, visibleNotesRef, onSwitchTabRef, onReplaceRef, onSelectNoteRef])
}
