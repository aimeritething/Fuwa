import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Tab } from './types'
import { Editor } from './components/Editor'
import { OpenEditors } from './components/OpenEditors'
import { Explorer } from './components/Explorer'
import { useFolder, pickFolderToOpen } from './hooks/useFolder'
import { useExplorerActions } from './hooks/useExplorerActions'
import { useDocumentWatcher } from './hooks/useDocumentWatcher'
import { buildExplorerTree, documentRoot } from './utils/explorer'
import { activeTabPaths } from './utils/imageFile'
import { findByNotePath } from './utils/notePathIdentity'
import { isWithinPrefix } from './hooks/folder-actions/folderActionUtils'
import { Sidebar } from './components/Sidebar'
import { useAppearance } from './hooks/useAppearance'
import { WriteFailureDialog } from './components/WriteFailureDialog'
import { useAppKeyboard } from './hooks/useAppKeyboard'
import { useDocumentDrop } from './hooks/useDocumentDrop'
import { useEditorSave } from './hooks/useEditorSave'
import { useFinderOpen } from './hooks/useFinderOpen'
import { useMenuEvents, type MenuEventHandlers } from './hooks/useMenuEvents'
import { useNoteTabs } from './hooks/useNoteTabs'
import { useSession } from './hooks/useSession'
import { useSidebar } from './hooks/useSidebar'
import { useToast } from './hooks/useToast'
import { useTabCommands } from './hooks/useTabCommands'
import { useThemeMode } from './hooks/useThemeMode'
import { useWriteFailureRecord, useWriteFailures } from './hooks/useWriteFailures'
import { closeAppWindow, exitApp } from './utils/appWindow'
import { pickNoteToOpen } from './utils/noteOpenDialog'
import { openNotesSettled } from './utils/noteOpenRequest'

const noop = () => {}

/**
 * Fuwa has no toasts: a refused write is recorded by the Write failure hook
 * and shown as the error bar; "Saved" is the path row's job.
 */
const ignoreSaveToast = () => {}

/** The watcher refreshes Explorer metadata after writes. */
const noVaultContentToUpdate = () => {}

/**
 * Rich-mode edits reach disk 1.5 s after the last keystroke: the kernel's
 * serialization debounce (RICH_EDITOR_CHANGE_DEBOUNCE_MS) is that idle wait,
 * so the save hook's own timer is not stacked on top of it. Disk first; the
 * buffer stays put when the write is refused (Autosave, CONTEXT.md) and the
 * refusal becomes the Document's error bar.
 */
function useAutosaveOnEditorChange(
  handleContentChange: (path: string, content: string) => void,
  savePendingForPath: (path: string) => Promise<boolean>,
  recordFailure: (path: string, error: unknown) => void,
  isOpen: (path: string) => boolean,
) {
  return useCallback(
    (path: string, content: string) => {
      // A Document with no Tab is never written: the editor flushes its idle
      // debounce as the Tab it belonged to goes away, and a file that has just
      // been trashed or deleted in Finder must not come back (spec section 5).
      if (!isOpen(path)) return
      handleContentChange(path, content)
      savePendingForPath(path).catch((error: unknown) => recordFailure(path, error))
    },
    [handleContentChange, isOpen, recordFailure, savePendingForPath],
  )
}

/**
 * The save hook's persistence scope: the boundary root of every open
 * Document (ADR-0002), deepest first so a Document's own directory wins.
 * Scoping every Tab rather than the active one means a keystroke that lands
 * while a Tab switch is still writing is not cleared with the scope change;
 * the kernel flushes it at the path change and the write goes through.
 */
function useOpenNoteRoots(tabs: Tab[], folder: string | null): readonly string[] {
  const rootsKey = Array.from(new Set(tabs.map((tab) => documentRoot(tab.entry.path, folder))))
    .sort((a, b) => b.length - a.length)
    .join('\n')
  return useMemo(() => (rootsKey === '' ? [] : rootsKey.split('\n')), [rootsKey])
}

/** When each open Document's last write landed; the path row shows the active one's. */
function useSavedTimes() {
  const [savedAtByPath, setSavedAtByPath] = useState<Record<string, number>>({})
  const markSaved = useCallback((path: string) => {
    setSavedAtByPath((prev) => ({ ...prev, [path]: Date.now() }))
  }, [])
  const forgetSaved = useCallback((path: string) => {
    setSavedAtByPath((prev) => {
      if (!(path in prev)) return prev
      const rest = { ...prev }
      delete rest[path]
      return rest
    })
  }, [])
  return { savedAtByPath, markSaved, forgetSaved }
}

export default function App() {
  const { toast, showToast } = useToast()
  const folderState = useFolder()
  const { folder, changeFolder } = folderState
  const {
    tabs,
    setTabs,
    activeTabPath,
    openNote,
    closeTab,
    closeAllTabs,
    reloadTab,
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    retargetTabs,
    setTabMode,
    restoreOpenEditors,
  } = useNoteTabs(folder, folderState.listsFile)
  const appearance = useAppearance()
  const { sidebar, toggle: toggleSidebar, collapse: collapseSidebar, setWidth: setSidebarWidth, restore: restoreSidebar } = useSidebar()
  const { restored } = useSession({
    folder,
    restoreFolder: folderState.restoreFolder,
    tabs,
    activeTabPath,
    theme: appearance.themeMode,
    restoreOpenEditors,
    restoreTheme: appearance.restoreTheme,
    sidebar,
    restoreSidebar,
  })
  useThemeMode(appearance.themeMode, restored)
  const { savedAtByPath, markSaved, forgetSaved } = useSavedTimes()
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const flushPendingRawContentRef = useRef<((path: string) => void) | null>(null)
  const hasPendingEditorContentRef = useRef<((path: string) => boolean) | null>(null)
  // Toggle Rich/Raw lives in the editor, which registers it here (AIM-381).
  const rawToggleRef = useRef<(() => void) | null>(null)
  /** Push whichever surface is showing the Document's fresh keystrokes into the save buffer. */
  const flushEditorBuffers = useCallback((path: string) => {
    flushPendingEditorContentRef.current?.(path)
    flushPendingRawContentRef.current?.(path)
  }, [])
  const vaultPath = activeTabPath ? documentRoot(activeTabPath, folder) : undefined
  // Save, Toggle Rich/Raw and Find in Document follow the active Document;
  // an Image Tab leaves all three disabled (spec section 4). Its row in the
  // Folder listing is its byte size and the version its picture is fetched at.
  const { documentPath: activeDocumentPath, imagePath: activeImagePath } = activeTabPaths(activeTabPath)
  const activeImageFile = findByNotePath(folderState.files, activeImagePath) ?? null
  const persistenceScope = useOpenNoteRoots(tabs, folder)

  // A write that lands, from any path, clears the Document's error bar.
  const writeFailureRecord = useWriteFailureRecord()
  const { clearFailure: clearWriteFailure, recordFailure: recordWriteFailure } = writeFailureRecord
  const onNotePersisted = useCallback((path: string) => {
    markSaved(path)
    clearWriteFailure(path)
  }, [clearWriteFailure, markSaved])

  const { handleContentChange, savePendingForPath, discardPending, hasPendingSave } = useEditorSave({
    updateVaultContent: noVaultContentToUpdate,
    setTabs,
    setToastMessage: ignoreSaveToast,
    onNotePersisted,
    persistenceScope,
  })

  /**
   * Push the rich editor's fresh keystrokes into the save buffer and write
   * the active Document's pending edits, while its directory is still the
   * persistence scope. Every Tab switch, close, ⌘S and ⌘Q goes through here
   * (spec section 3 writes a Document's pending edits before it closes). Only
   * the active Document's buffer: another Document's refused edits stay in
   * the save hook's buffer and are its own bar's to retry, never this Tab's.
   */
  const settleActiveNote = useCallback(async () => {
    if (!activeTabPath) return
    flushEditorBuffers(activeTabPath)
    await savePendingForPath(activeTabPath)
  }, [activeTabPath, flushEditorBuffers, savePendingForPath])

  /**
   * Retry: the save hook's buffer, which kept the refused edits and, once the
   * rich editor's fresh keystrokes are flushed into it, is the latest content.
   * The Tab's copy stands in when the buffer has since moved to another
   * Document.
   */
  const writeBuffer = useCallback(async (path: string, content: string) => {
    if (path === activeTabPath) flushEditorBuffers(path)
    if (await savePendingForPath(path)) return
    handleContentChange(path, content)
    await savePendingForPath(path)
  }, [activeTabPath, flushEditorBuffers, handleContentChange, savePendingForPath])

  /** Discard changes: forget the buffered edits, then read the disk bytes back into the Tab. */
  const revertToDisk = useCallback(async (path: string) => {
    discardPending(path)
    await reloadTab(path)
  }, [discardPending, reloadTab])

  const closeTabAndForget = useCallback((path: string) => {
    closeTab(path)
    forgetSaved(path)
  }, [closeTab, forgetSaved])

  const writeFailures = useWriteFailures({
    record: writeFailureRecord,
    tabs,
    activeTabPath,
    settleActiveNote,
    writeBuffer,
    revertToDisk,
    closeTab: closeTabAndForget,
    exitApp,
  })
  const { settleAndRecord, closeTabOrAsk, retry, discard, quit, answerPrompt, dismissPrompt } = writeFailures
  // The open paths, so a flush that arrives after a Tab has gone is refused
  // rather than recreating its file. The editor reaches this through a ref it
  // refreshes before its own swap effect runs, so the set is never the stale one.
  const openPaths = useMemo(() => new Set(tabs.map((tab) => tab.entry.path)), [tabs])
  const isOpenPath = useCallback((path: string) => openPaths.has(path), [openPaths])
  const onContentChange = useAutosaveOnEditorChange(handleContentChange, savePendingForPath, recordWriteFailure, isOpenPath)
  // Raw mode's keystrokes take the same road, after the raw editor's own idle
  // debounce (ADR-0003). A report that matches what the Tab already holds is
  // not an edit: the raw editor re-reports on unmount what a flush just wrote.
  const tabsRef = useRef(tabs)
  useLayoutEffect(() => {
    tabsRef.current = tabs
  }, [tabs])
  const onRawContentChange = useCallback((path: string, content: string) => {
    if (tabsRef.current.find((tab) => tab.entry.path === path)?.content === content) return
    onContentChange(path, content)
  }, [onContentChange])

  /** The open Tabs a path covers: the file itself, or everything under a folder. */
  const pathsUnder = useCallback((prefix: string) => (
    tabs.map((tab) => tab.entry.path).filter((path) => isWithinPrefix({ path, prefix }))
  ), [tabs])

  /**
   * Write the pending edits of every open Document at or under a path. Move to
   * Trash asks for this first, so a Document reaches the Trash holding the
   * edit that was still in the buffer. A refused write is swallowed rather
   * than recorded: the delete goes ahead either way, and the Tab that would
   * carry the error bar is about to close.
   */
  const settleTabsUnder = useCallback(async (prefix: string) => {
    for (const path of pathsUnder(prefix)) {
      if (path === activeTabPath) flushEditorBuffers(path)
      await savePendingForPath(path).catch(() => {})
    }
  }, [activeTabPath, flushEditorBuffers, pathsUnder, savePendingForPath])

  /**
   * Cancel the pending Autosave of every Tab at or under a path and close them
   * (spec section 5, rules 1, 3 and 5). The cancellation comes first: the
   * buffered edits belong to a file that is not there any more.
   */
  const dropTabsUnder = useCallback((prefix: string) => {
    for (const path of pathsUnder(prefix)) {
      discardPending(path)
      clearWriteFailure(path)
      closeTabAndForget(path)
    }
  }, [clearWriteFailure, closeTabAndForget, discardPending, pathsUnder])

  const tabCommands = useTabCommands({
    activeTabPath,
    settleActiveNote: settleAndRecord,
    closeTab: closeTabOrAsk,
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    closeWindow: closeAppWindow,
  })

  // A Document or an Image file row: both open a real Tab (spec section 4).
  const openExplorerFile = useCallback((path: string) => {
    void openNotesSettled({ openNote, paths: [path], settleActiveNote: settleAndRecord })
  }, [openNote, settleAndRecord])

  // The Explorer's write operations (AIM-387). The tree is built here because
  // the placement rule behind ⌘N reads the selected row, and ⌘N is an app
  // command rather than the Explorer's own.
  const explorerTree = useMemo(
    () => (folder ? buildExplorerTree(folder, folderState.files) : null),
    [folder, folderState.files],
  )
  const explorerActions = useExplorerActions({
    folder,
    tree: explorerTree,
    activeTabPath,
    refresh: folderState.refresh,
    openNote: openExplorerFile,
    settleActiveDocument: settleAndRecord,
    retargetTabs,
    settleTabsUnder,
    dropTabsUnder,
    showToast,
  })

  const settleAndCloseAll = useCallback(async () => {
    try {
      await settleAndRecord()
    } catch {
      if (activeTabPath) closeTabOrAsk(activeTabPath)
      throw new Error('Folder change stopped by a Write failure')
    }
    for (const tab of tabs) {
      const path = tab.entry.path
      if (writeFailureRecord.failuresRef.current[path] && !(await retry(path))) {
        closeTabOrAsk(path)
        throw new Error('Folder change stopped by a Write failure')
      }
      await savePendingForPath(path)
    }
    closeAllTabs()
    for (const tab of tabs) { forgetSaved(tab.entry.path); clearWriteFailure(tab.entry.path) }
  }, [activeTabPath, clearWriteFailure, closeAllTabs, closeTabOrAsk, forgetSaved, retry, savePendingForPath, settleAndRecord, tabs, writeFailureRecord.failuresRef])

  const onOpenFolder = useCallback(() => {
    void (async () => {
      const path = await pickFolderToOpen()
      if (path) await changeFolder(path, settleAndCloseAll)
    })().catch((error: unknown) => console.warn('Could not open Folder:', error))
  }, [changeFolder, settleAndCloseAll])
  const onCloseFolder = useCallback(() => {
    void changeFolder(null, settleAndCloseAll).catch((error: unknown) => console.warn('Could not close Folder:', error))
  }, [changeFolder, settleAndCloseAll])

  const isPending = useCallback((path: string) => Boolean(
    hasPendingEditorContentRef.current?.(path) || hasPendingSave(path) || writeFailureRecord.failuresRef.current[path]
  ), [hasPendingSave, writeFailureRecord.failuresRef])
  useDocumentWatcher({
    folder,
    paths: tabs.map((tab) => tab.entry.path),
    refresh: folderState.refresh,
    reload: reloadTab,
    isPending,
    listedPaths: folderState.listedPaths,
    retargetTabs: retargetTabs,
    dropTabsUnder: dropTabsUnder,
  })

  /**
   * Opening a Document with no Folder open collapses the sidebar (spec
   * section 2): there is nothing to browse, so the card takes the window. With
   * a Folder open the sidebar stays as it is. File → Open Document… and a
   * `.md` dropped on the window both open this way; the Explorer's rows
   * cannot, there being no Folder to click in.
   */
  const openLoneNote = useCallback(async (path: string) => {
    await openNote(path)
    if (folder === null) collapseSidebar()
  }, [collapseSidebar, folder, openNote])

  const onOpenNote = useCallback(() => {
    void (async () => {
      const path = await pickNoteToOpen()
      if (!path) return
      await openNotesSettled({ openNote: openLoneNote, paths: [path], settleActiveNote: settleAndRecord })
    })()
  }, [openLoneNote, settleAndRecord])

  // Save is disabled with no Document open — and an Image Tab is not one, so
  // ⌘S over a picture does nothing. The native menu item goes the same way
  // through update_menu_state. A refusal is the error bar's.
  const onSave = useCallback(() => {
    if (!activeDocumentPath) return
    settleAndRecord().catch(noop)
  }, [activeDocumentPath, settleAndRecord])

  // Toggle Rich/Raw (⌘\, View menu) is disabled with no Document open, like
  // Save: an undefined handler is how the dispatcher reads disabled, and the
  // native menu follows through update_menu_state.
  const onToggleRawEditor = useCallback(() => rawToggleRef.current?.(), [])

  // Folder, Document, Save, Quit, Appearance, Sidebar, Tab and Rich/Raw
  // commands are wired; the other manifest commands get their handlers with
  // their own tickets. ⌘[ toggles the sidebar in both states; in Raw mode it
  // shadows CodeMirror's indent-less (⌘] stays the editor's).
  const handlers = useMemo<MenuEventHandlers>(() => ({
    activeDocumentPath,
    hasFolder: folder !== null,
    onOpenNote,
    onOpenVault: onOpenFolder,
    onCloseVault: onCloseFolder,
    onSave,
    onQuit: quit,
    onToggleSidebar: toggleSidebar,
    onToggleRawEditor: activeDocumentPath ? onToggleRawEditor : undefined,
    ...tabCommands.handlers,
    ...appearance.handlers,
    onCreateNote: explorerActions.createDocument,
    onQuickOpen: noop,
    onPastePlainText: noop,
    onCommandPalette: noop,
    onZoomIn: noop,
    onZoomOut: noop,
    onZoomReset: noop,
  }), [activeDocumentPath, appearance.handlers, explorerActions.createDocument, folder, onOpenNote, onOpenFolder, onCloseFolder, onSave, onToggleRawEditor, quit, tabCommands, toggleSidebar])
  useAppKeyboard(handlers)
  useMenuEvents(handlers)
  // A `.md` dropped on the window opens like File → Open Document…; an image
  // dropped over a Document is the editor's, and nothing else is picked up.
  useDocumentDrop({ openNote: openLoneNote, settleActiveNote: settleAndRecord })
  // Finder double-click, Open With and the Dock icon open the same way, once
  // the Session is back so the Folder is known (AIM-391). The shell stays
  // unpainted until the launch Document is in place.
  const { settled: finderOpenSettled } = useFinderOpen({ openNote: openLoneNote, settleActiveNote: settleAndRecord, ready: restored })

  const savedAt = activeTabPath ? savedAtByPath[activeTabPath] ?? null : null

  // Nothing is painted until the Session is back and any Finder launch
  // Document is open, so a launch never shows the expanded sidebar, or the
  // Session's Tab, for a frame before the right state (the window's own
  // background colour is the canvas until then).
  return (
    <div className="fuwa-shell" data-restoring={!(restored && finderOpenSettled) || undefined}>
      {!sidebar.collapsed && (
      <Sidebar width={sidebar.width} onWidthChange={setSidebarWidth} onToggle={toggleSidebar}>
        <OpenEditors
          folder={folder}
          tabs={tabs}
          activeTabPath={activeTabPath}
          onActivate={tabCommands.activateTabSettled}
          onClose={tabCommands.closeTabSettled}
        />
        <Explorer
          folder={folder}
          tree={explorerTree}
          activeTabPath={activeTabPath}
          onOpenFile={openExplorerFile}
          actions={explorerActions}
          onCloseFolder={onCloseFolder}
          onOpenFolder={onOpenFolder}
          error={folderState.error}
        />
      </Sidebar>
      )}
      <Editor
        tabs={tabs}
        activeTabPath={activeTabPath}
        imageFile={activeImageFile}
        vaultPath={vaultPath}
        folder={folder}
        hasPendingEditorContentRef={hasPendingEditorContentRef}
        savedAt={savedAt}
        onContentChange={onContentChange}
        onRawContentChange={onRawContentChange}
        flushPendingEditorContentRef={flushPendingEditorContentRef}
        flushPendingRawContentRef={flushPendingRawContentRef}
        rawToggleRef={rawToggleRef}
        onSetTabMode={setTabMode}
        onActivateTab={tabCommands.activateTabSettled}
        onCloseTab={tabCommands.closeTabSettled}
        writeFailure={writeFailures.failureFor(activeTabPath)}
        onRetryWrite={retry}
        onDiscardWrite={discard}
        toast={toast}
        sidebarCollapsed={sidebar.collapsed}
        onShowSidebar={toggleSidebar}
      />
      <WriteFailureDialog prompt={writeFailures.prompt} onAnswer={answerPrompt} onDismiss={dismissPrompt} />
    </div>
  )
}
