import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { SetStateAction } from 'react'
import { useSaveNote } from './useSaveNote'

interface Tab {
  entry: { path: string }
  content: string
}

interface EditorSaveConfig {
  updateVaultContent: (path: string, content: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tab types vary between layers
  setTabs: (fn: SetStateAction<any[]>) => void
  setToastMessage: (msg: string | null) => void
  onAfterSave?: () => void
  /** Called after content is persisted — used to clear unsaved state and live-reload themes. */
  onNotePersisted?: (path: string, content: string) => void
  /** Resolve stale paths (for example after a note rename) before persisting buffered content. */
  resolvePath?: (path: string) => string
}

/**
 * Hook that manages editor content persistence with auto-save.
 * Content is auto-saved 500ms after the last edit. Cmd+S flushes immediately.
 */
const noop = () => {}

const AUTO_SAVE_DEBOUNCE_MS = 500

interface PendingContent {
  path: string
  content: string
}

function resolveBufferedPath(path: string, resolvePath?: EditorSaveConfig['resolvePath']): string {
  return resolvePath?.(path) ?? path
}

function matchesPendingPath(
  pending: PendingContent | null,
  pathFilter?: string,
  resolvePath?: EditorSaveConfig['resolvePath'],
): pending is PendingContent {
  if (!pending) return false
  if (!pathFilter) return true
  return resolveBufferedPath(pending.path, resolvePath) === resolveBufferedPath(pathFilter, resolvePath)
}

async function persistResolvedContent({
  path,
  content,
  saveNote,
  onNotePersisted,
  resolvePath,
}: {
  path: string
  content: string
  saveNote: (path: string, content: string) => Promise<void>
  onNotePersisted?: EditorSaveConfig['onNotePersisted']
  resolvePath?: EditorSaveConfig['resolvePath']
}): Promise<void> {
  const targetPath = resolveBufferedPath(path, resolvePath)
  await saveNote(targetPath, content)
  onNotePersisted?.(targetPath, content)
}

function applyTabContent(
  setTabs: EditorSaveConfig['setTabs'],
  path: string,
  content: string,
): void {
  setTabs((prev: Tab[]) =>
    prev.map((t) => t.entry.path === path ? { ...t, content } : t)
  )
}

function scheduleAutoSave({
  autoSaveTimerRef,
  flushPending,
  onAfterSaveRef,
}: {
  autoSaveTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  flushPending: () => Promise<boolean>
  onAfterSaveRef: MutableRefObject<() => void>
}): void {
  autoSaveTimerRef.current = setTimeout(async () => {
    autoSaveTimerRef.current = null
    try {
      const saved = await flushPending()
      if (saved) onAfterSaveRef.current()
    } catch (err) {
      console.error('Auto-save failed:', err)
    }
  }, AUTO_SAVE_DEBOUNCE_MS)
}

export function useEditorSave({
  updateVaultContent,
  setTabs,
  setToastMessage,
  onAfterSave = noop,
  onNotePersisted,
  resolvePath,
}: EditorSaveConfig) {
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateTabAndContent = useCallback((path: string, content: string) => {
    updateVaultContent(path, content)
    applyTabContent(setTabs, path, content)
  }, [updateVaultContent, setTabs])

  const { saveNote } = useSaveNote(updateTabAndContent)

  /** Persist pending content matching an optional path filter; returns true if saved */
  const flushPending = useCallback(async (pathFilter?: string): Promise<boolean> => {
    const pending = pendingContentRef.current
    if (!matchesPendingPath(pending, pathFilter, resolvePath)) return false
    const { path, content: savedContent } = pending
    await persistResolvedContent({ path, content: savedContent, saveNote, onNotePersisted, resolvePath })
    pendingContentRef.current = null
    return true
  }, [saveNote, onNotePersisted, resolvePath])

  // Stable ref for onAfterSave so the auto-save timer closure always calls the latest version
  const onAfterSaveRef = useRef(onAfterSave)
  useEffect(() => { onAfterSaveRef.current = onAfterSave }, [onAfterSave])

  /** Cancel any pending auto-save timer. */
  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [])

  /** Called by Cmd+S — persists the current editor content to disk.
   *  Accepts optional fallback for unsaved notes with no pending edits. */
  const handleSave = useCallback(async (unsavedFallback?: { path: string; content: string }) => {
    cancelAutoSave()
    try {
      const saved = await flushPending()
      const savedFallback = !saved && !!unsavedFallback && await (async () => {
        await persistResolvedContent({
          path: unsavedFallback.path,
          content: unsavedFallback.content,
          saveNote,
          onNotePersisted,
          resolvePath,
        })
        return true
      })()
      setToastMessage(saved || savedFallback ? 'Saved' : 'Nothing to save')
      onAfterSave()
    } catch (err) {
      console.error('Save failed:', err)
      setToastMessage(`Save failed: ${err}`)
    }
  }, [cancelAutoSave, flushPending, setToastMessage, onAfterSave, saveNote, onNotePersisted, resolvePath])

  /** Called by Editor onChange — buffers the latest content, syncs tab state,
   *  and schedules an auto-save after 500ms of inactivity. */
  const handleContentChange = useCallback((path: string, content: string) => {
    pendingContentRef.current = { path, content }
    applyTabContent(setTabs, path, content)
    cancelAutoSave()
    scheduleAutoSave({ autoSaveTimerRef, flushPending: () => flushPending(), onAfterSaveRef })
  }, [setTabs, cancelAutoSave, flushPending])

  // Clear auto-save timer on unmount
  useEffect(() => () => cancelAutoSave(), [cancelAutoSave])

  /** Save pending content for a specific path (used before rename / tab close) */
  const savePendingForPath = useCallback(
    (path: string): Promise<boolean> => { cancelAutoSave(); return flushPending(path) },
    [cancelAutoSave, flushPending],
  )

  /** Flush any pending content to disk silently (used before git commit).
   * Does NOT call onAfterSave — callers manage their own refresh. */
  const savePending = useCallback((): Promise<boolean> => { cancelAutoSave(); return flushPending() }, [cancelAutoSave, flushPending])

  return { handleSave, handleContentChange, savePendingForPath, savePending }
}
