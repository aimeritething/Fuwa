import { useCallback, useMemo, useRef, useState } from 'react'
import { Editor } from './components/Editor'
import { OpenEditors } from './components/OpenEditors'
import { Sidebar } from './components/Sidebar'
import { useAppKeyboard } from './hooks/useAppKeyboard'
import { useEditorSave } from './hooks/useEditorSave'
import { useMenuEvents, type MenuEventHandlers } from './hooks/useMenuEvents'
import { useNoteTabs } from './hooks/useNoteTabs'
import { useSession } from './hooks/useSession'
import { useTabCommands } from './hooks/useTabCommands'
import { closeAppWindow } from './utils/appWindow'
import { noteRootForPath } from './utils/noteEntry'
import { pickNoteToOpen } from './utils/noteOpenDialog'

const noop = () => {}

/**
 * Fuwa has no toasts: a failed write is already logged by the save hook and
 * gets its error bar in AIM-385; "Saved" is the path row's job.
 */
const ignoreSaveToast = () => {}

/** Nothing outside the Document's own content to refresh after a write yet. */
const noVaultContentToUpdate = () => {}

/**
 * Rich-mode edits reach disk 1.5 s after the last keystroke: the kernel's
 * serialization debounce (RICH_EDITOR_CHANGE_DEBOUNCE_MS) is that idle wait,
 * so the save hook's own timer is not stacked on top of it. Disk first; the
 * buffer stays put when the write fails (Autosave, CONTEXT.md).
 */
function useAutosaveOnEditorChange(
  handleContentChange: (path: string, content: string) => void,
  savePending: () => Promise<boolean>,
) {
  return useCallback(
    (path: string, content: string) => {
      handleContentChange(path, content)
      savePending().catch((error: unknown) => {
        console.error('Autosave failed:', error)
      })
    },
    [handleContentChange, savePending],
  )
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
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    restoreOpenEditors,
  } = useNoteTabs()
  useSession({ tabs, activeTabPath, restoreOpenEditors })
  const { savedAtByPath, markSaved, forgetSaved } = useSavedTimes()
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const vaultPath = activeTabPath ? noteRootForPath(activeTabPath) : undefined

  const { handleSave, handleContentChange, savePending } = useEditorSave({
    updateVaultContent: noVaultContentToUpdate,
    setTabs,
    setToastMessage: ignoreSaveToast,
    onNotePersisted: markSaved,
    persistenceScope: vaultPath,
  })
  const onContentChange = useAutosaveOnEditorChange(handleContentChange, savePending)

  /**
   * Push the rich editor's fresh keystrokes into the save buffer and write
   * them, while the active Document's directory is still the persistence
   * scope. Every Tab switch and close goes through here (spec section 3
   * flushes a dirty Document before it closes).
   */
  const settleActiveNote = useCallback(async () => {
    if (activeTabPath) flushPendingEditorContentRef.current?.(activeTabPath)
    await savePending()
  }, [activeTabPath, savePending])

  const closeTabAndForget = useCallback((path: string) => {
    closeTab(path)
    forgetSaved(path)
  }, [closeTab, forgetSaved])

  const tabCommands = useTabCommands({
    activeTabPath,
    settleActiveNote,
    closeTab: closeTabAndForget,
    activateTab,
    activateTabAt,
    activateAdjacentTab,
    closeWindow: closeAppWindow,
  })

  const onOpenNote = useCallback(() => {
    void (async () => {
      const path = await pickNoteToOpen()
      if (!path) return
      await settleActiveNote().catch((error: unknown) => {
        console.error('Autosave failed:', error)
      })
      try {
        await openNote(path)
      } catch (error) {
        console.error(`Failed to open ${path}:`, error)
      }
    })()
  }, [openNote, settleActiveNote])

  // Save is disabled with no Document open: the native menu item through
  // update_menu_state, the ⌘S keydown here.
  const onSave = useCallback(() => {
    if (!activeTabPath) return
    flushPendingEditorContentRef.current?.(activeTabPath)
    void handleSave()
  }, [activeTabPath, handleSave])

  // Open Document…, Save and the Tab commands are wired; the other manifest
  // commands get their handlers with their own tickets.
  const handlers = useMemo<MenuEventHandlers>(() => ({
    activeTabPath,
    onOpenNote,
    onSave,
    onCloseTab: tabCommands.onCloseTab,
    onPreviousTab: tabCommands.onPreviousTab,
    onNextTab: tabCommands.onNextTab,
    onJumpToTab1: tabCommands.onJumpToTab1,
    onJumpToTab2: tabCommands.onJumpToTab2,
    onJumpToTab3: tabCommands.onJumpToTab3,
    onJumpToTab4: tabCommands.onJumpToTab4,
    onJumpToTab5: tabCommands.onJumpToTab5,
    onJumpToTab6: tabCommands.onJumpToTab6,
    onJumpToTab7: tabCommands.onJumpToTab7,
    onJumpToTab8: tabCommands.onJumpToTab8,
    onJumpToTab9: tabCommands.onJumpToTab9,
    onCreateNote: noop,
    onQuickOpen: noop,
    onPastePlainText: noop,
    onCommandPalette: noop,
    onZoomIn: noop,
    onZoomOut: noop,
    onZoomReset: noop,
  }), [activeTabPath, onOpenNote, onSave, tabCommands])
  useAppKeyboard(handlers)
  useMenuEvents(handlers)

  const savedAt = activeTabPath ? savedAtByPath[activeTabPath] ?? null : null

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
      />
    </div>
  )
}
