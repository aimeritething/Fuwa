import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { FolderNode } from '../../types'
import type { FolderContextMenuState } from './FolderContextMenu'

interface UseFolderContextMenuInput {
  onDeleteFolder?: (folderPath: string) => void
  onStartRenameFolder?: (folderPath: string) => void
}

export function useFolderContextMenu({
  onDeleteFolder,
  onStartRenameFolder,
}: UseFolderContextMenuInput) {
  const [contextMenu, setContextMenu] = useState<FolderContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    if (!contextMenu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeContextMenu()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [closeContextMenu, contextMenu])

  const handleOpenMenu = useCallback((node: FolderNode, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      path: node.path,
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const handleRenameFromMenu = useCallback((folderPath: string) => {
    closeContextMenu()
    onStartRenameFolder?.(folderPath)
  }, [closeContextMenu, onStartRenameFolder])

  const handleDeleteFromMenu = useCallback((folderPath: string) => {
    closeContextMenu()
    onDeleteFolder?.(folderPath)
  }, [closeContextMenu, onDeleteFolder])

  return {
    closeContextMenu,
    contextMenu,
    handleDeleteFromMenu,
    handleOpenMenu,
    handleRenameFromMenu,
    menuRef,
  }
}
