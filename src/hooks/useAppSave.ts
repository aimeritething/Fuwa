import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorSaveWithLinks } from './useEditorSaveWithLinks'
import { needsRenameOnSave } from './useNoteRename'
import { flushEditorContent } from '../utils/autoSave'
import { extractH1TitleFromContent } from '../utils/noteTitle'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'

interface TabState {
  entry: VaultEntry
  content: string
}

const UNTITLED_RENAME_DEBOUNCE_MS = 2500

interface PendingUntitledRename {
  path: string
  timer: ReturnType<typeof setTimeout>
}

function findUnsavedFallback(
  tabs: TabState[], activeTabPath: string | null, unsavedPaths: Set<string>,
): { path: string; content: string } | undefined {
  const activeTab = tabs.find(t => t.entry.path === activeTabPath)
  if (!activeTab || !unsavedPaths.has(activeTab.entry.path)) return undefined
  return { path: activeTab.entry.path, content: activeTab.content }
}

function activeTabNeedsRename(tabs: TabState[], activeTabPath: string | null): { path: string; title: string } | null {
  const activeTab = tabs.find(t => t.entry.path === activeTabPath)
  if (!activeTab) return null
  return needsRenameOnSave(activeTab.entry.title, activeTab.entry.filename)
    ? { path: activeTab.entry.path, title: activeTab.entry.title }
    : null
}

function isUntitledRenameCandidate(path: string): boolean {
  const filename = path.split('/').pop() ?? ''
  const stem = filename.replace(/\.md$/, '')
  return stem.startsWith('untitled-') && /\d+$/.test(stem)
}

function shouldScheduleUntitledRename(path: string, content: string): boolean {
  return isTauri()
    && isUntitledRenameCandidate(path)
    && extractH1TitleFromContent(content) !== null
}

function matchingPendingRename(
  pending: PendingUntitledRename | null,
  path?: string,
): PendingUntitledRename | null {
  if (!pending) return null
  if (path && pending.path !== path) return null
  return pending
}

function takePendingRename(
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>,
  path?: string,
): PendingUntitledRename | null {
  const pending = matchingPendingRename(pendingRenameRef.current, path)
  if (!pending) return null
  clearTimeout(pending.timer)
  pendingRenameRef.current = null
  return pending
}

function schedulePendingRename(
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>,
  path: string,
  onFire: (path: string) => void,
): void {
  takePendingRename(pendingRenameRef)
  const timer = setTimeout(() => {
    const pending = takePendingRename(pendingRenameRef, path)
    if (pending) onFire(pending.path)
  }, UNTITLED_RENAME_DEBOUNCE_MS)
  pendingRenameRef.current = { path, timer }
}

function pendingRenameOutsideActiveTab(
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>,
  activeTabPath: string | null,
): string | null {
  const pending = pendingRenameRef.current
  if (!pending || pending.path === activeTabPath) return null
  return pending.path
}

async function reloadAutoRenamedNote(
  oldPath: string,
  newPath: string,
  replaceEntry: AppSaveDeps['replaceEntry'],
  loadModifiedFiles: AppSaveDeps['loadModifiedFiles'],
): Promise<void> {
  const [newEntry, newContent] = await Promise.all([
    invoke<VaultEntry>('reload_vault_entry', { path: newPath }),
    invoke<string>('get_note_content', { path: newPath }),
  ])
  replaceEntry(oldPath, { ...newEntry, path: newPath }, newContent)
  loadModifiedFiles()
}

interface AppSaveDeps {
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSaveWithLinks>[0]['setTabs']
  setToastMessage: (msg: string | null) => void
  loadModifiedFiles: () => void
  reloadViews?: () => Promise<void>
  clearUnsaved: (path: string) => void
  unsavedPaths: Set<string>
  tabs: TabState[]
  activeTabPath: string | null
  handleRenameNote: (path: string, newTitle: string, vaultPath: string, onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void) => Promise<void>
  replaceEntry: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void
  resolvedPath: string
}

export function useAppSave({
  updateEntry, setTabs, setToastMessage,
  loadModifiedFiles, reloadViews, clearUnsaved, unsavedPaths,
  tabs, activeTabPath,
  handleRenameNote, replaceEntry, resolvedPath,
}: AppSaveDeps) {
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})
  const pendingUntitledRenameRef = useRef<PendingUntitledRename | null>(null)

  const onAfterSave = useCallback(() => {
    loadModifiedFiles()
  }, [loadModifiedFiles])

  const cancelPendingUntitledRename = useCallback((path?: string) => (
    takePendingRename(pendingUntitledRenameRef, path) !== null
  ), [])

  const executeUntitledRename = useCallback(async (path: string) => {
    try {
      const result = await invoke<{ new_path: string; updated_files: number } | null>('auto_rename_untitled', {
        vaultPath: resolvedPath,
        notePath: path,
      })
      if (!result) return false
      await reloadAutoRenamedNote(path, result.new_path, replaceEntry, loadModifiedFiles)
      return true
    } catch {
      return false
    }
  }, [resolvedPath, replaceEntry, loadModifiedFiles])

  const flushPendingUntitledRename = useCallback(async (path?: string) => {
    const pending = takePendingRename(pendingUntitledRenameRef, path)
    if (!pending) return false
    return executeUntitledRename(pending.path)
  }, [executeUntitledRename])

  const scheduleUntitledRename = useCallback((path: string, content: string) => {
    if (!shouldScheduleUntitledRename(path, content)) {
      cancelPendingUntitledRename(path)
      return
    }

    schedulePendingRename(pendingUntitledRenameRef, path, (pendingPath) => {
      void executeUntitledRename(pendingPath)
    })
  }, [cancelPendingUntitledRename, executeUntitledRename])

  const onNotePersisted = useCallback((path: string, content: string) => {
    clearUnsaved(path)
    if (path.endsWith('.yml')) reloadViews?.()
    scheduleUntitledRename(path, content)
  }, [clearUnsaved, reloadViews, scheduleUntitledRename])

  const { handleSave: handleSaveRaw, handleContentChange, savePendingForPath, savePending } = useEditorSaveWithLinks({
    updateEntry, setTabs, setToastMessage, onAfterSave, onNotePersisted,
  })

  useEffect(() => { contentChangeRef.current = handleContentChange }, [handleContentChange])
  useEffect(() => () => { cancelPendingUntitledRename() }, [cancelPendingUntitledRename])
  useEffect(() => {
    const pendingPath = pendingRenameOutsideActiveTab(pendingUntitledRenameRef, activeTabPath)
    if (pendingPath) cancelPendingUntitledRename(pendingPath)
  }, [activeTabPath, cancelPendingUntitledRename])

  // Refs for stable closure in flushBeforeAction
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs // eslint-disable-line react-hooks/refs -- ref sync pattern
  const unsavedPathsRef = useRef(unsavedPaths)
  unsavedPathsRef.current = unsavedPaths // eslint-disable-line react-hooks/refs -- ref sync pattern

  const flushBeforeAction = useCallback(async (path: string) => {
    try {
      await flushEditorContent(path, {
        savePendingForPath,
        getTabContent: (p) => tabsRef.current.find(t => t.entry.path === p)?.content,
        isUnsaved: (p) => unsavedPathsRef.current.has(p),
        onSaved: (p) => { clearUnsaved(p) },
      })
      await flushPendingUntitledRename(path)
    } catch (err) {
      setToastMessage(`Auto-save failed: ${err}`)
      throw err
    }
  }, [savePendingForPath, clearUnsaved, setToastMessage, flushPendingUntitledRename])

  const handleRenameTab = useCallback(async (path: string, newTitle: string) => {
    await savePendingForPath(path)
    cancelPendingUntitledRename(path)
    await handleRenameNote(path, newTitle, resolvedPath, replaceEntry).then(loadModifiedFiles)
  }, [handleRenameNote, resolvedPath, replaceEntry, savePendingForPath, loadModifiedFiles, cancelPendingUntitledRename])

  const handleSave = useCallback(async () => {
    await handleSaveRaw(findUnsavedFallback(tabs, activeTabPath, unsavedPaths))
    const flushedUntitledRename = await flushPendingUntitledRename(activeTabPath ?? undefined)
    const rename = activeTabNeedsRename(tabs, activeTabPath)
    if (!flushedUntitledRename && rename) await handleRenameTab(rename.path, rename.title)
  }, [handleSaveRaw, handleRenameTab, tabs, activeTabPath, unsavedPaths, flushPendingUntitledRename])

  const handleTitleSync = useCallback((path: string, newTitle: string) => {
    cancelPendingUntitledRename(path)
    savePendingForPath(path)
      .then(() => handleRenameNote(path, newTitle, resolvedPath, replaceEntry))
      .then(loadModifiedFiles)
      .catch((err) => console.error('Title rename failed:', err))
  }, [handleRenameNote, resolvedPath, replaceEntry, savePendingForPath, loadModifiedFiles, cancelPendingUntitledRename])

  return {
    contentChangeRef,
    handleContentChange,
    handleSave,
    handleTitleSync,
    savePending,
    savePendingForPath,
    flushBeforeAction,
  }
}
