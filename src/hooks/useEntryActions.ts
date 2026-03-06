import { useCallback } from 'react'
import type { VaultEntry } from '../types'

interface EntryActionsConfig {
  entries: VaultEntry[]
  updateEntry: (path: string, updates: Partial<VaultEntry>) => void
  handleUpdateFrontmatter: (path: string, key: string, value: string | number | boolean | string[]) => Promise<void>
  handleDeleteProperty: (path: string, key: string) => Promise<void>
  setToastMessage: (msg: string | null) => void
  createTypeEntry: (typeName: string) => Promise<VaultEntry>
  onFrontmatterPersisted?: () => void
}

function findTypeEntry(entries: VaultEntry[], typeName: string): VaultEntry | undefined {
  return entries.find((e) => e.isA === 'Type' && e.title === typeName)
}

export function useEntryActions({
  entries, updateEntry, handleUpdateFrontmatter, handleDeleteProperty, setToastMessage, createTypeEntry, onFrontmatterPersisted,
}: EntryActionsConfig) {
  const handleTrashNote = useCallback(async (path: string) => {
    const now = new Date().toISOString().slice(0, 10)
    await handleUpdateFrontmatter(path, 'Trashed', true)
    await handleUpdateFrontmatter(path, 'Trashed at', now)
    updateEntry(path, { trashed: true, trashedAt: Date.now() / 1000 })
    setToastMessage('Note moved to trash')
    onFrontmatterPersisted?.()
  }, [handleUpdateFrontmatter, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleRestoreNote = useCallback(async (path: string) => {
    await handleUpdateFrontmatter(path, 'Trashed', false)
    await handleDeleteProperty(path, 'Trashed at')
    updateEntry(path, { trashed: false, trashedAt: null })
    setToastMessage('Note restored from trash')
    onFrontmatterPersisted?.()
  }, [handleUpdateFrontmatter, handleDeleteProperty, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleArchiveNote = useCallback(async (path: string) => {
    await handleUpdateFrontmatter(path, 'archived', true)
    updateEntry(path, { archived: true })
    setToastMessage('Note archived')
    onFrontmatterPersisted?.()
  }, [handleUpdateFrontmatter, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleUnarchiveNote = useCallback(async (path: string) => {
    await handleUpdateFrontmatter(path, 'archived', false)
    updateEntry(path, { archived: false })
    setToastMessage('Note unarchived')
    onFrontmatterPersisted?.()
  }, [handleUpdateFrontmatter, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleCustomizeType = useCallback(async (typeName: string, icon: string, color: string) => {
    let typeEntry = findTypeEntry(entries, typeName)
    if (!typeEntry) typeEntry = await createTypeEntry(typeName)
    updateEntry(typeEntry.path, { icon, color })
    await handleUpdateFrontmatter(typeEntry.path, 'icon', icon)
    await handleUpdateFrontmatter(typeEntry.path, 'color', color)
  }, [entries, handleUpdateFrontmatter, updateEntry, createTypeEntry])

  const handleReorderSections = useCallback((orderedTypes: { typeName: string; order: number }[]) => {
    for (const { typeName, order } of orderedTypes) {
      const typeEntry = findTypeEntry(entries, typeName)
      if (!typeEntry) continue
      handleUpdateFrontmatter(typeEntry.path, 'order', order)
      updateEntry(typeEntry.path, { order })
    }
  }, [entries, handleUpdateFrontmatter, updateEntry])

  const handleUpdateTypeTemplate = useCallback((typeName: string, template: string) => {
    const typeEntry = findTypeEntry(entries, typeName)
    if (!typeEntry) return
    handleUpdateFrontmatter(typeEntry.path, 'template', template)
    updateEntry(typeEntry.path, { template: template || null })
  }, [entries, handleUpdateFrontmatter, updateEntry])

  const handleRenameSection = useCallback(async (typeName: string, label: string) => {
    const typeEntry = findTypeEntry(entries, typeName)
    if (!typeEntry) return
    const trimmed = label.trim()
    updateEntry(typeEntry.path, { sidebarLabel: trimmed || null })
    if (trimmed) {
      await handleUpdateFrontmatter(typeEntry.path, 'sidebar label', trimmed)
    } else {
      await handleDeleteProperty(typeEntry.path, 'sidebar label')
    }
  }, [entries, handleUpdateFrontmatter, handleDeleteProperty, updateEntry])

  const handleToggleTypeVisibility = useCallback(async (typeName: string) => {
    let typeEntry = findTypeEntry(entries, typeName)
    if (!typeEntry) typeEntry = await createTypeEntry(typeName)
    if (typeEntry.visible === false) {
      updateEntry(typeEntry.path, { visible: null })
      await handleDeleteProperty(typeEntry.path, 'visible')
    } else {
      updateEntry(typeEntry.path, { visible: false })
      await handleUpdateFrontmatter(typeEntry.path, 'visible', false)
    }
  }, [entries, handleUpdateFrontmatter, handleDeleteProperty, updateEntry, createTypeEntry])

  return { handleTrashNote, handleRestoreNote, handleArchiveNote, handleUnarchiveNote, handleCustomizeType, handleReorderSections, handleUpdateTypeTemplate, handleRenameSection, handleToggleTypeVisibility }
}
