import { useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { slugify } from './useNoteCreation'

interface RenameResult {
  new_path: string
  updated_files: number
}

export { slugify }

/** Check if a note's filename doesn't match the slug of its current title. */
export function needsRenameOnSave(title: string, filename: string): boolean {
  return `${slugify(title)}.md` !== filename
}

export async function performRename(
  path: string,
  newTitle: string,
  vaultPath: string,
  oldTitle?: string,
): Promise<RenameResult> {
  if (isTauri()) {
    return invoke<RenameResult>('rename_note', { vaultPath, oldPath: path, newTitle, oldTitle: oldTitle ?? null })
  }
  return mockInvoke<RenameResult>('rename_note', { vault_path: vaultPath, old_path: path, new_title: newTitle, old_title: oldTitle ?? null })
}

export async function performFilenameRename(
  path: string,
  newFilenameStem: string,
  vaultPath: string,
): Promise<RenameResult> {
  if (isTauri()) {
    return invoke<RenameResult>('rename_note_filename', {
      vaultPath,
      oldPath: path,
      newFilenameStem,
    })
  }
  return mockInvoke<RenameResult>('rename_note_filename', {
    vault_path: vaultPath,
    old_path: path,
    new_filename_stem: newFilenameStem,
  })
}

export function buildRenamedEntry(entry: VaultEntry, newTitle: string, newPath: string): VaultEntry {
  const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return { ...entry, path: newPath, filename: `${slug}.md`, title: newTitle }
}

export function buildFilenameRenamedEntry(entry: VaultEntry, newPath: string): VaultEntry {
  const filename = newPath.split('/').pop() ?? entry.filename
  return { ...entry, path: newPath, filename }
}

export async function loadNoteContent(path: string): Promise<string> {
  return isTauri()
    ? invoke<string>('get_note_content', { path })
    : mockInvoke<string>('get_note_content', { path })
}

export function renameToastMessage(updatedFiles: number): string {
  if (updatedFiles === 0) return 'Renamed'
  return `Renamed — updated ${updatedFiles} wiki link${updatedFiles > 1 ? 's' : ''}`
}

/** Reload content for open tabs whose wikilinks may have changed after a rename. */
export async function reloadTabsAfterRename(
  tabPaths: string[],
  updateTabContent: (path: string, content: string) => void,
): Promise<void> {
  for (const tabPath of tabPaths) {
    try {
      updateTabContent(tabPath, await loadNoteContent(tabPath))
    } catch { /* skip tabs that fail to reload */ }
  }
}

interface Tab {
  entry: VaultEntry
  content: string
}

function renameErrorMessage(err: unknown): string {
  const message = typeof err === 'string'
    ? err.trim()
    : err instanceof Error
      ? err.message.trim()
      : ''
  if (message === 'A note with that name already exists' || message === 'Invalid filename') {
    return message
  }
  return 'Failed to rename note'
}

export interface NoteRenameConfig {
  entries: VaultEntry[]
  setToastMessage: (msg: string | null) => void
}

interface RenameTabDeps {
  tabs: Tab[]
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  activeTabPathRef: React.MutableRefObject<string | null>
  handleSwitchTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
}

export function useNoteRename(config: NoteRenameConfig, tabDeps: RenameTabDeps) {
  const { entries, setToastMessage } = config
  const { setTabs, activeTabPathRef, handleSwitchTab, updateTabContent } = tabDeps

  const tabsRef = useRef(tabDeps.tabs)
  // eslint-disable-next-line react-hooks/refs
  tabsRef.current = tabDeps.tabs

  const applyRenameResult = useCallback(async (
    oldPath: string,
    result: RenameResult,
    buildEntry: (entry: VaultEntry | undefined, newPath: string) => VaultEntry,
    onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
  ) => {
    const entry = entries.find((item) => item.path === oldPath)
    const newContent = await loadNoteContent(result.new_path)
    const newEntry = buildEntry(entry, result.new_path)
    const otherTabPaths = tabsRef.current.filter((tab) => tab.entry.path !== oldPath).map((tab) => tab.entry.path)
    setTabs((prev) => prev.map((tab) => tab.entry.path === oldPath ? { entry: newEntry, content: newContent } : tab))
    if (activeTabPathRef.current === oldPath) handleSwitchTab(result.new_path)
    onEntryRenamed(oldPath, newEntry, newContent)
    await reloadTabsAfterRename(otherTabPaths, updateTabContent)
    setToastMessage(renameToastMessage(result.updated_files))
  }, [entries, setTabs, activeTabPathRef, handleSwitchTab, updateTabContent, setToastMessage])

  const handleRenameNote = useCallback(async (
    path: string, newTitle: string, vaultPath: string,
    onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
  ) => {
    try {
      const entry = entries.find((e) => e.path === path)
      const result = await performRename(path, newTitle, vaultPath, entry?.title)
      await applyRenameResult(
        path,
        result,
        (currentEntry, newPath) => buildRenamedEntry(currentEntry ?? {} as VaultEntry, newTitle, newPath),
        onEntryRenamed,
      )
    } catch (err) {
      console.error('Failed to rename note:', err)
      setToastMessage(renameErrorMessage(err))
    }
  }, [entries, applyRenameResult, setToastMessage])

  const handleRenameFilename = useCallback(async (
    path: string,
    newFilenameStem: string,
    vaultPath: string,
    onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
  ) => {
    try {
      const result = await performFilenameRename(path, newFilenameStem, vaultPath)
      await applyRenameResult(
        path,
        result,
        (currentEntry, newPath) => buildFilenameRenamedEntry(currentEntry ?? {} as VaultEntry, newPath),
        onEntryRenamed,
      )
    } catch (err) {
      console.error('Failed to rename note filename:', err)
      setToastMessage(renameErrorMessage(err))
    }
  }, [applyRenameResult, setToastMessage])

  return { handleRenameNote, handleRenameFilename, tabsRef }
}
