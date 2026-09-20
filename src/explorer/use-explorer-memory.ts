import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'

export type ExpandedFolders = Record<string, boolean>

/** What the tree did on its own, kept so that a remount does not do it again. */
export interface ExplorerViewMemory {
  scrollTop: number
  /** The selected row and the row in rename the tree last brought into view. */
  revealedSelected: string | null
  revealedEditing: string | null
}

export interface ExplorerMemory {
  manualExpanded: ExpandedFolders
  setManualExpanded: Dispatch<SetStateAction<ExpandedFolders>>
  /** Read and written from effects and listeners only; none of it renders. */
  view: () => ExplorerViewMemory
}

const NOTHING_EXPANDED: ExpandedFolders = {}

/**
 * What the Explorer remembers while it is not on screen: the folders opened
 * and shut by hand, the scroll position, and the rows it has already brought
 * into view. Collapsing the sidebar unmounts the Explorer, so App holds this
 * above the sidebar. It lasts for the run and belongs to one Folder:
 * another Folder starts with nothing remembered.
 */
export function useExplorerMemory(folder: string | null): ExplorerMemory {
  const [held, setHeld] = useState({ folder, expanded: NOTHING_EXPANDED })
  const manualExpanded = held.folder === folder ? held.expanded : NOTHING_EXPANDED

  const setManualExpanded = useCallback<Dispatch<SetStateAction<ExpandedFolders>>>((update) => {
    setHeld((current) => {
      const base = current.folder === folder ? current.expanded : NOTHING_EXPANDED
      const expanded = typeof update === 'function' ? update(base) : update
      return expanded === base && current.folder === folder ? current : { folder, expanded }
    })
  }, [folder])

  const viewRef = useRef<{ folder: string | null; view: ExplorerViewMemory } | null>(null)
  const view = useCallback(() => {
    if (viewRef.current?.folder !== folder) {
      viewRef.current = { folder, view: { scrollTop: 0, revealedSelected: null, revealedEditing: null } }
    }
    return viewRef.current.view
  }, [folder])

  return useMemo(() => ({ manualExpanded, setManualExpanded, view }), [manualExpanded, setManualExpanded, view])
}
