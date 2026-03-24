import { useEffect, useMemo, useRef } from 'react'
import { filterEntries, sortByModified, buildRelationshipGroups } from '../utils/noteListHelpers'
import type { VaultEntry, SidebarSelection } from '../types'

interface KeyboardNavigationOptions {
  activeTabPath: string | null
  entries: VaultEntry[]
  selection: SidebarSelection
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

function useLatestRef<T>(value: T): React.RefObject<T> {
  const ref = useRef(value)
  useEffect(() => { ref.current = value })
  return ref
}

export function useKeyboardNavigation({
  activeTabPath, entries, selection,
  onReplaceActiveTab, onSelectNote,
}: KeyboardNavigationOptions) {
  const visibleNotes = useMemo(
    () => computeVisibleNotes(entries, selection),
    [entries, selection],
  )

  const activeTabPathRef = useLatestRef(activeTabPath)
  const visibleNotesRef = useLatestRef(visibleNotes)
  const onReplaceRef = useLatestRef(onReplaceActiveTab)
  const onSelectNoteRef = useLatestRef(onSelectNote)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      // Cmd+Alt+ArrowUp/Down: navigate notes in the current list
      if (e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const direction: 1 | -1 = e.key === 'ArrowDown' ? 1 : -1
        navigateNote(visibleNotesRef, activeTabPathRef, onReplaceRef, onSelectNoteRef, direction)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabPathRef, visibleNotesRef, onReplaceRef, onSelectNoteRef])
}
