import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Tab } from './types'
import { Editor } from './components/Editor'
import { OpenEditors } from './components/OpenEditors'
import { Sidebar } from './components/Sidebar'
import { useAppearance } from './hooks/useAppearance'
import { WriteFailureDialog } from './components/WriteFailureDialog'
import { useAppKeyboard } from './hooks/useAppKeyboard'
import { useEditorSave } from './hooks/useEditorSave'
import { useMenuEvents, type MenuEventHandlers } from './hooks/useMenuEvents'
import { useNoteTabs } from './hooks/useNoteTabs'
import { useSession } from './hooks/useSession'
import { useTabCommands } from './hooks/useTabCommands'
import { useThemeMode } from './hooks/useThemeMode'
import { closeAppWindow } from './utils/appWindow'
import { useWriteFailures, type WritePromptChoice } from './hooks/useWriteFailures'
import { closeAppWindow, exitApp } from './utils/appWindow'
import { noteRootForPath } from './utils/noteEntry'
import { pickNoteToOpen } from './utils/noteOpenDialog'

const noop = () => {}

/**
 * Fuwa has no toasts: a refused write is recorded by the Write failure hook
 * and shown as the error bar; "Saved" is the path row's job.
 */
const ignoreSaveToast = () => {}

/** Nothing outside the Document's own content to refresh after a write yet. */
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
  savePending: () => Promise<boolean>,
  recordFailure: (path: string, error: unknown) => void,
) {
  return useCallback(
    (path: string, content: string) => {
      handleContentChange(path, content)
      savePending().catch((error: unknown) => recordFailure(path, error))
    },
    [handleContentChange, recordFailure, savePending],
  )
}

/**
 * The save hook's persistence scope: the boundary root of every open
 * Document (ADR-0002), deepest first so a Document's own directory wins.
 * Scoping every Tab rather than the active one means a keystroke that lands
 * while a Tab switch is still writing is not cleared with the scope change;
 * the kernel flushes it at the path change and the write goes through.
 */
function useOpenNoteRoots(tabs: Tab[]): readonly string[] {
  const rootsKey = Array.from(new Set(tabs.map((tab) => noteRootForPath(tab.entry.path))))
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
  const {
    tabs,
    setTabs,
    activeTabPath,
    openNote,
    closeTab,
    reloadTab,
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    restoreOpenEditors,
  } = useNoteTabs()
  const appearance = useAppearance()
  const { restored } = useSession({
    tabs,
    activeTabPath,
    theme: appearance.themeMode,
    restoreOpenEditors,
    restoreTheme: appearance.restoreTheme,
  })
  useThemeMode(appearance.themeMode, restored)
  const { savedAtByPath, markSaved, forgetSaved } = useSavedTimes()
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const vaultPath = activeTabPath ? noteRootForPath(activeTabPath) : undefined
  const persistenceScope = useOpenNoteRoots(tabs)

  // A write that lands clears the Document's error bar; the Write failure
  // hook is built from the save hook's own commands, so it is reached late.
  const clearWriteFailureRef = useRef<(path: string) => void>(noop)
  const onNotePersisted = useCallback((path: string) => {
    markSaved(path)
    clearWriteFailureRef.current(path)
  }, [markSaved])

  const { handleContentChange, savePending, savePendingForPath, discardPending } = useEditorSave({
    updateVaultContent: noVaultContentToUpdate,
    setTabs,
    setToastMessage: ignoreSaveToast,
    onNotePersisted,
    persistenceScope,
  })

  /**
   * Push the rich editor's fresh keystrokes into the save buffer and write
   * them, while the active Document's directory is still the persistence
   * scope. Every Tab switch, close, ⌘S and ⌘Q goes through here (spec section
   * 3 flushes a dirty Document before it closes).
   */
  const settleActiveNote = useCallback(async () => {
    if (activeTabPath) flushPendingEditorContentRef.current?.(activeTabPath)
    await savePending()
  }, [activeTabPath, savePending])

  /** Retry: the Tab's buffer is the latest content, written again through the save hook. */
  const writeBuffer = useCallback(async (path: string, content: string) => {
    handleContentChange(path, content)
    await savePendingForPath(path)
  }, [handleContentChange, savePendingForPath])

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
    tabs,
    activeTabPath,
    settleActiveNote,
    writeBuffer,
    revertToDisk,
    closeTab: closeTabAndForget,
    exitApp,
  })
  const {
    clearFailure: clearWriteFailure,
    recordFailure: recordWriteFailure,
    settleActiveNote: settleActiveNoteRecorded,
    closeTab: closeTabGuarded,
    retry: retryWrite,
    discard: discardWrite,
    quit,
    answerPrompt,
    dismissPrompt,
  } = writeFailures
  useEffect(() => {
    clearWriteFailureRef.current = clearWriteFailure
  }, [clearWriteFailure])
  const onContentChange = useAutosaveOnEditorChange(handleContentChange, savePending, recordWriteFailure)

  const tabCommands = useTabCommands({
    activeTabPath,
    settleActiveNote: settleActiveNoteRecorded,
    closeTab: closeTabGuarded,
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    closeWindow: closeAppWindow,
  })

  const onOpenNote = useCallback(() => {
    void (async () => {
      const path = await pickNoteToOpen()
      if (!path) return
      // A refused write is recorded against its Tab; opening goes ahead.
      await settleActiveNoteRecorded().catch(noop)
      try {
        await openNote(path)
      } catch (error) {
        console.error(`Failed to open ${path}:`, error)
      }
    })()
  }, [openNote, settleActiveNoteRecorded])

  // Save is disabled with no Document open: the native menu item through
  // update_menu_state, the ⌘S keydown here. A refusal is the error bar's.
  const onSave = useCallback(() => {
    if (!activeTabPath) return
    settleActiveNoteRecorded().catch(noop)
  }, [activeTabPath, settleActiveNoteRecorded])

  const onQuit = useCallback(() => {
    quit().catch((error: unknown) => {
      console.error('Quit failed:', error)
    })
  }, [quit])

  // Open Document…, Save, Quit, Appearance and the Tab commands are wired;
  // the other manifest commands get their handlers with their own tickets.
  const handlers = useMemo<MenuEventHandlers>(() => ({
    activeTabPath,
    onOpenNote,
    onSave,
    onQuit,
    ...tabCommands.handlers,
    ...appearance.handlers,
    onCreateNote: noop,
    onQuickOpen: noop,
    onPastePlainText: noop,
    onCommandPalette: noop,
    onZoomIn: noop,
    onZoomOut: noop,
    onZoomReset: noop,
  }), [activeTabPath, appearance.handlers, onOpenNote, onQuit, onSave, tabCommands])
  useAppKeyboard(handlers)
  useMenuEvents(handlers)

  const savedAt = activeTabPath ? savedAtByPath[activeTabPath] ?? null : null
  const onRetryWrite = useCallback((path: string) => {
    void retryWrite(path)
  }, [retryWrite])
  const onDiscardWrite = useCallback((path: string) => {
    void discardWrite(path)
  }, [discardWrite])
  const onAnswerPrompt = useCallback((choice: WritePromptChoice) => {
    void answerPrompt(choice)
  }, [answerPrompt])

  return (
    <div className="fuwa-shell">
      <Sidebar>
        <OpenEditors
          tabs={tabs}
          activeTabPath={activeTabPath}
          onActivate={tabCommands.activateTabSettled}
          onClose={tabCommands.closeTabSettled}
        />
      </Sidebar>
      <Editor
        tabs={tabs}
        activeTabPath={activeTabPath}
        vaultPath={vaultPath}
        savedAt={savedAt}
        onContentChange={onContentChange}
        flushPendingEditorContentRef={flushPendingEditorContentRef}
        onActivateTab={tabCommands.activateTabSettled}
        onCloseTab={tabCommands.closeTabSettled}
        writeFailure={writeFailures.failureFor(activeTabPath)}
        onRetryWrite={onRetryWrite}
        onDiscardWrite={onDiscardWrite}
      />
      <WriteFailureDialog prompt={writeFailures.prompt} onAnswer={onAnswerPrompt} onDismiss={dismissPrompt} />
    </div>
  )
}
