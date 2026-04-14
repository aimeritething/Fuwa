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

type RenamedPathMap = Map<string, string>

function resolveLatestPath(renamedPaths: RenamedPathMap, path: string): string {
  let current = path
  const visited = new Set<string>()

  while (!visited.has(current)) {
    visited.add(current)
    const next = renamedPaths.get(current)
    if (!next || next === current) break
    current = next
  }

  return current
}

function trackRenamedPath(renamedPaths: RenamedPathMap, oldPath: string, newPath: string): void {
  if (oldPath === newPath) return
  renamedPaths.set(oldPath, newPath)
}

function findUnsavedFallback({
  tabs,
  activeTabPath,
  unsavedPaths,
}: {
  tabs: TabState[]
  activeTabPath: string | null
  unsavedPaths: Set<string>
}): { path: string; content: string } | undefined {
  const activeTab = tabs.find(t => t.entry.path === activeTabPath)
  if (!activeTab || !unsavedPaths.has(activeTab.entry.path)) return undefined
  return { path: activeTab.entry.path, content: activeTab.content }
}

function activeTabNeedsRename({
  tabs,
  activeTabPath,
}: {
  tabs: TabState[]
  activeTabPath: string | null
}): { path: string; title: string } | null {
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

function shouldScheduleUntitledRename({ path, content }: { path: string; content: string }): boolean {
  return isTauri()
    && isUntitledRenameCandidate(path)
    && extractH1TitleFromContent(content) !== null
}

function matchingPendingRename({
  pending,
  path,
}: {
  pending: PendingUntitledRename | null
  path?: string
},
): PendingUntitledRename | null {
  if (!pending) return null
  if (path && pending.path !== path) return null
  return pending
}

function takePendingRename({
  pendingRenameRef,
  path,
}: {
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>
  path?: string
},
): PendingUntitledRename | null {
  const pending = matchingPendingRename({ pending: pendingRenameRef.current, path })
  if (!pending) return null
  clearTimeout(pending.timer)
  pendingRenameRef.current = null
  return pending
}

function schedulePendingRename({
  pendingRenameRef,
  path,
  onFire,
}: {
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>
  path: string
  onFire: (path: string) => void
},
): void {
  takePendingRename({ pendingRenameRef })
  const timer = setTimeout(() => {
    const pending = takePendingRename({ pendingRenameRef, path })
    if (pending) onFire(pending.path)
  }, UNTITLED_RENAME_DEBOUNCE_MS)
  pendingRenameRef.current = { path, timer }
}

function pendingRenameOutsideActiveTab({
  pendingRenameRef,
  activeTabPath,
}: {
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>
  activeTabPath: string | null
},
): string | null {
  const pending = pendingRenameRef.current
  if (!pending || pending.path === activeTabPath) return null
  return pending.path
}

async function reloadAutoRenamedNote(
  {
    oldPath,
    newPath,
    tabsRef,
    activeTabPathRef,
    setTabs,
    handleSwitchTab,
    replaceEntry,
    loadModifiedFiles,
  }: {
    oldPath: string
    newPath: string
    tabsRef: MutableRefObject<TabState[]>
    activeTabPathRef: MutableRefObject<string | null>
    setTabs: AppSaveDeps['setTabs']
    handleSwitchTab: AppSaveDeps['handleSwitchTab']
    replaceEntry: AppSaveDeps['replaceEntry']
    loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
  },
): Promise<void> {
  const [newEntry, newContent] = await Promise.all([
    invoke<VaultEntry>('reload_vault_entry', { path: newPath }),
    invoke<string>('get_note_content', { path: newPath }),
  ])

  const preservedContent = activeTabPathRef.current === oldPath
    ? tabsRef.current.find((tab) => tab.entry.path === oldPath)?.content ?? newContent
    : newContent

  const otherTabPaths = tabsRef.current
    .filter((tab) => tab.entry.path !== oldPath && tab.entry.path !== newPath)
    .map((tab) => tab.entry.path)

  setTabs((prev: TabState[]) => prev.map((tab) => (
    tab.entry.path === oldPath
      ? { entry: { ...tab.entry, ...newEntry, path: newPath }, content: preservedContent }
      : tab
  )))
  if (activeTabPathRef.current === oldPath) handleSwitchTab(newPath)
  replaceEntry(oldPath, { ...newEntry, path: newPath }, preservedContent)
  await Promise.all(otherTabPaths.map(async (path) => {
    const content = await invoke<string>('get_note_content', { path })
    setTabs((prev: TabState[]) => prev.map((tab) => (
      tab.entry.path === path ? { ...tab, content } : tab
    )))
  }))
  loadModifiedFiles()
}

interface AppSaveDeps {
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSaveWithLinks>[0]['setTabs']
  handleSwitchTab: (path: string) => void
  setToastMessage: (msg: string | null) => void
  loadModifiedFiles: () => void
  reloadViews?: () => Promise<void>
  clearUnsaved: (path: string) => void
  unsavedPaths: Set<string>
  tabs: TabState[]
  activeTabPath: string | null
  handleRenameNote: (path: string, newTitle: string, vaultPath: string, onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void) => Promise<void>
  handleRenameFilename: (path: string, newFilenameStem: string, vaultPath: string, onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void) => Promise<void>
  replaceEntry: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void
  resolvedPath: string
}

export function useAppSave({
  updateEntry, setTabs, handleSwitchTab, setToastMessage,
  loadModifiedFiles, reloadViews, clearUnsaved, unsavedPaths,
  tabs, activeTabPath,
  handleRenameNote, handleRenameFilename: handleRenameFilenameRaw, replaceEntry, resolvedPath,
}: AppSaveDeps) {
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})
  const pendingUntitledRenameRef = useRef<PendingUntitledRename | null>(null)
  const renamedPathsRef = useRef<RenamedPathMap>(new Map())
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs // eslint-disable-line react-hooks/refs -- ref sync pattern
  const activeTabPathRef = useRef(activeTabPath)
  activeTabPathRef.current = activeTabPath // eslint-disable-line react-hooks/refs -- ref sync pattern
  const unsavedPathsRef = useRef(unsavedPaths)
  unsavedPathsRef.current = unsavedPaths // eslint-disable-line react-hooks/refs -- ref sync pattern

  const onAfterSave = useCallback(() => {
    loadModifiedFiles()
  }, [loadModifiedFiles])

  const cancelPendingUntitledRename = useCallback((path?: string) => (
    takePendingRename({ pendingRenameRef: pendingUntitledRenameRef, path }) !== null
  ), [])

  const executeUntitledRename = useCallback(async (path: string) => {
    try {
      const result = await invoke<{ new_path: string; updated_files: number } | null>('auto_rename_untitled', {
        vaultPath: resolvedPath,
        notePath: path,
      })
      if (!result) return false
      trackRenamedPath(renamedPathsRef.current, path, result.new_path)
      await reloadAutoRenamedNote({
        oldPath: path,
        newPath: result.new_path,
        tabsRef,
        activeTabPathRef,
        setTabs,
        handleSwitchTab,
        replaceEntry,
        loadModifiedFiles,
      })
      return true
    } catch {
      return false
    }
  }, [resolvedPath, setTabs, handleSwitchTab, replaceEntry, loadModifiedFiles])

  const flushPendingUntitledRename = useCallback(async (path?: string) => {
    const pending = takePendingRename({ pendingRenameRef: pendingUntitledRenameRef, path })
    if (!pending) return false
    return executeUntitledRename(pending.path)
  }, [executeUntitledRename])

  const scheduleUntitledRename = useCallback((path: string, content: string) => {
    if (!shouldScheduleUntitledRename({ path, content })) {
      cancelPendingUntitledRename(path)
      return
    }

    schedulePendingRename({
      pendingRenameRef: pendingUntitledRenameRef,
      path,
      onFire: (pendingPath) => {
      void executeUntitledRename(pendingPath)
      },
    })
  }, [cancelPendingUntitledRename, executeUntitledRename])

  const onNotePersisted = useCallback((path: string, content: string) => {
    clearUnsaved(path)
    if (path.endsWith('.yml')) reloadViews?.()
    scheduleUntitledRename(path, content)
  }, [clearUnsaved, reloadViews, scheduleUntitledRename])

  const { handleSave: handleSaveRaw, handleContentChange: handleContentChangeRaw, savePendingForPath: savePendingForPathRaw, savePending } = useEditorSaveWithLinks({
    updateEntry, setTabs, setToastMessage, onAfterSave, onNotePersisted,
  })

  const registerRenamedPath = useCallback((oldPath: string, newPath: string) => {
    trackRenamedPath(renamedPathsRef.current, oldPath, newPath)
  }, [])

  const resolveCurrentPath = useCallback((path: string) => resolveLatestPath(renamedPathsRef.current, path), [])

  const handleContentChange = useCallback((path: string, content: string) => {
    handleContentChangeRaw(resolveCurrentPath(path), content)
  }, [handleContentChangeRaw, resolveCurrentPath])

  const savePendingForPath = useCallback((path: string) => savePendingForPathRaw(resolveCurrentPath(path)), [savePendingForPathRaw, resolveCurrentPath])

  const replaceRenamedEntry = useCallback((oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => {
    registerRenamedPath(oldPath, newEntry.path)
    replaceEntry(oldPath, newEntry, newContent)
  }, [registerRenamedPath, replaceEntry])

  useEffect(() => { contentChangeRef.current = handleContentChange }, [handleContentChange])
  useEffect(() => () => { cancelPendingUntitledRename() }, [cancelPendingUntitledRename])
  useEffect(() => {
    const pendingPath = pendingRenameOutsideActiveTab({
      pendingRenameRef: pendingUntitledRenameRef,
      activeTabPath,
    })
    if (pendingPath) cancelPendingUntitledRename(pendingPath)
  }, [activeTabPath, cancelPendingUntitledRename])

  const flushBeforeAction = useCallback(async (path: string) => {
    const currentPath = resolveCurrentPath(path)
    try {
      await flushEditorContent(currentPath, {
        savePendingForPath,
        getTabContent: (p) => tabsRef.current.find(t => t.entry.path === p)?.content,
        isUnsaved: (p) => unsavedPathsRef.current.has(p),
        onSaved: (p) => { clearUnsaved(p) },
      })
      await flushPendingUntitledRename(currentPath)
    } catch (err) {
      setToastMessage(`Auto-save failed: ${err}`)
      throw err
    }
  }, [resolveCurrentPath, savePendingForPath, clearUnsaved, setToastMessage, flushPendingUntitledRename])

  const handleRenameTab = useCallback(async (path: string, newTitle: string) => {
    const currentPath = resolveCurrentPath(path)
    await savePendingForPath(currentPath)
    cancelPendingUntitledRename(currentPath)
    await handleRenameNote(currentPath, newTitle, resolvedPath, replaceRenamedEntry).then(loadModifiedFiles)
  }, [resolveCurrentPath, handleRenameNote, resolvedPath, replaceRenamedEntry, savePendingForPath, loadModifiedFiles, cancelPendingUntitledRename])

  const handleFilenameRename = useCallback(async (path: string, newFilenameStem: string) => {
    const currentPath = resolveCurrentPath(path)
    await savePendingForPath(currentPath)
    cancelPendingUntitledRename(currentPath)
    await handleRenameFilenameRaw(currentPath, newFilenameStem, resolvedPath, replaceRenamedEntry).then(loadModifiedFiles)
  }, [resolveCurrentPath, handleRenameFilenameRaw, resolvedPath, replaceRenamedEntry, savePendingForPath, loadModifiedFiles, cancelPendingUntitledRename])

  const handleSave = useCallback(async () => {
    const resolvedActiveTabPath = activeTabPath ? resolveCurrentPath(activeTabPath) : null
    await handleSaveRaw(findUnsavedFallback({
      tabs,
      activeTabPath: resolvedActiveTabPath,
      unsavedPaths,
    }))
    const flushedUntitledRename = await flushPendingUntitledRename(resolvedActiveTabPath ?? undefined)
    const rename = activeTabNeedsRename({ tabs, activeTabPath: resolvedActiveTabPath })
    if (!flushedUntitledRename && rename) await handleRenameTab(rename.path, rename.title)
  }, [handleSaveRaw, handleRenameTab, tabs, activeTabPath, unsavedPaths, flushPendingUntitledRename, resolveCurrentPath])

  const handleTitleSync = useCallback((path: string, newTitle: string) => {
    const currentPath = resolveCurrentPath(path)
    cancelPendingUntitledRename(currentPath)
    savePendingForPath(currentPath)
      .then(() => handleRenameNote(currentPath, newTitle, resolvedPath, replaceRenamedEntry))
      .then(loadModifiedFiles)
      .catch((err) => console.error('Title rename failed:', err))
  }, [resolveCurrentPath, handleRenameNote, resolvedPath, replaceRenamedEntry, savePendingForPath, loadModifiedFiles, cancelPendingUntitledRename])

  return {
    contentChangeRef,
    handleContentChange,
    handleFilenameRename,
    handleSave,
    handleTitleSync,
    savePending,
    savePendingForPath,
    trackRenamedPath: registerRenamedPath,
    flushBeforeAction,
  }
}
