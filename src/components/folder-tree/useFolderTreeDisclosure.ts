import { useCallback, useMemo, useState } from 'react'
import type { SidebarSelection } from '../../types'
import { expandedTreePaths, mergeExpandedPaths } from './folderTreeUtils'

interface UseFolderTreeDisclosureInput {
  collapsed?: boolean
  onToggle?: () => void
  renamingFolderPath?: string | null
  selection: SidebarSelection
}

export function useFolderTreeDisclosure({
  collapsed: externalCollapsed,
  onToggle,
  renamingFolderPath,
  selection,
}: UseFolderTreeDisclosureInput) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({})
  const [isCreating, setIsCreating] = useState(false)

  const baseSectionCollapsed = externalCollapsed ?? internalCollapsed
  const sectionCollapsed = !isCreating && !renamingFolderPath && baseSectionCollapsed
  const requiredExpandedPaths = useMemo(() => {
    const nextPaths: string[] = []
    if (selection.kind === 'folder') nextPaths.push(...expandedTreePaths(selection.path))
    if (renamingFolderPath) nextPaths.push(...expandedTreePaths(renamingFolderPath))
    return [...new Set(nextPaths)]
  }, [renamingFolderPath, selection])

  const expanded = useMemo(
    () => mergeExpandedPaths(manualExpanded, requiredExpandedPaths),
    [manualExpanded, requiredExpandedPaths],
  )

  const handleToggleSection = useCallback(() => {
    if (onToggle) {
      onToggle()
      return
    }
    setInternalCollapsed((current) => !current)
  }, [onToggle])

  const openCreateForm = useCallback(() => {
    if (baseSectionCollapsed) {
      if (onToggle) onToggle()
      else setInternalCollapsed(false)
    }
    setIsCreating(true)
  }, [baseSectionCollapsed, onToggle])

  const closeCreateForm = useCallback(() => setIsCreating(false), [])
  const toggleFolder = useCallback((path: string) => {
    setManualExpanded((current) => ({ ...current, [path]: !current[path] }))
  }, [])

  return {
    closeCreateForm,
    expanded,
    handleToggleSection,
    isCreating,
    openCreateForm,
    sectionCollapsed,
    toggleFolder,
  }
}
