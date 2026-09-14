import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke, updateMockContent } from '@/platform/tauri'
import { cacheNoteContent } from '@/kernel/resolve/note-content-cache'

/**
 * Fuwa's Rust boundary confines every write to the root the caller names, so
 * `vaultPath` travels with the content whenever the save hook knows it.
 */
export async function persistContent(path: string, content: string, vaultPath?: string): Promise<void> {
  const args = vaultPath ? { path, content, vaultPath } : { path, content }
  if (isTauri()) {
    await invoke('save_note_content', args)
  } else {
    await mockInvoke('save_note_content', args)
  }
}

/**
 * Hook that provides an explicit save function for note content.
 * Called on Cmd+S — no debounce, no auto-save.
 *
 * @param updateContent - callback to also update in-memory state after save
 */
export function useSaveNote(updateContent: (path: string, content: string) => void) {
  const saveNote = useCallback(async (path: string, content: string, vaultPath?: string) => {
    await persistContent(path, content, vaultPath)
    cacheNoteContent(path, content)
    if (!isTauri()) {
      updateMockContent(path, content)
    }
    updateContent(path, content)
  }, [updateContent])

  return { saveNote }
}
