import { useCallback, useMemo, useRef, useState } from 'react'
import { Editor } from './components/Editor'
import { useAppKeyboard } from './hooks/useAppKeyboard'
import { useEditorSave } from './hooks/useEditorSave'
import { useMenuEvents, type MenuEventHandlers } from './hooks/useMenuEvents'
import { useNoteTabs } from './hooks/useNoteTabs'
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

export default function App() {
  const { tabs, setTabs, activeTabPath, openNote } = useNoteTabs()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const vaultPath = activeTabPath ? noteRootForPath(activeTabPath) : undefined

  const onNotePersisted = useCallback(() => setSavedAt(Date.now()), [])
  const { handleSave, handleContentChange, savePending } = useEditorSave({
    updateVaultContent: noVaultContentToUpdate,
    setTabs,
    setToastMessage: ignoreSaveToast,
    onNotePersisted,
    persistenceScope: vaultPath,
  })
  const onContentChange = useAutosaveOnEditorChange(handleContentChange, savePending)

  /** Push the rich editor's fresh keystrokes into the save buffer, so nothing is younger than 1.5 s. */
  const flushOpenNote = useCallback(() => {
    if (activeTabPath) flushPendingEditorContentRef.current?.(activeTabPath)
  }, [activeTabPath])

  const onOpenNote = useCallback(() => {
    void (async () => {
      const path = await pickNoteToOpen()
      if (!path) return
      // With one Document at a time every open is a close, and a dirty
      // Document flushes before it closes (spec section 3): write it while
      // its own directory is still the persistence scope.
      flushOpenNote()
      await savePending().catch((error: unknown) => {
        console.error('Autosave failed:', error)
      })
      try {
        await openNote(path)
        setSavedAt(null)
      } catch (error) {
        console.error(`Failed to open ${path}:`, error)
      }
    })()
  }, [flushOpenNote, openNote, savePending])

  // Save is disabled with no Document open: the native menu item through
  // update_menu_state, the ⌘S keydown here.
  const onSave = useCallback(() => {
    if (!activeTabPath) return
    flushOpenNote()
    void handleSave()
  }, [activeTabPath, flushOpenNote, handleSave])

  // Only Open Document… and Save are wired in this slice; the other manifest
  // commands get their handlers with their own tickets.
  const handlers = useMemo<MenuEventHandlers>(() => ({
    activeTabPath,
    onOpenNote,
    onSave,
    onCreateNote: noop,
    onQuickOpen: noop,
    onPastePlainText: noop,
    onCommandPalette: noop,
    onZoomIn: noop,
    onZoomOut: noop,
    onZoomReset: noop,
  }), [activeTabPath, onOpenNote, onSave])
  useAppKeyboard(handlers)
  useMenuEvents(handlers)

  return (
    <div className="fuwa-shell">
      <Editor
        tabs={tabs}
        activeTabPath={activeTabPath}
        vaultPath={vaultPath}
        savedAt={savedAt}
        onContentChange={onContentChange}
        flushPendingEditorContentRef={flushPendingEditorContentRef}
      />
    </div>
  )
}
