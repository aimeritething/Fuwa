import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { trackEvent } from '../lib/telemetry'

interface ConfirmDeleteState {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

interface UseDeleteActionsInput {
  /** Called to deselect the note if it is currently open. */
  onDeselectNote: (path: string) => void
  removeEntry: (path: string) => void
  setToastMessage: (msg: string | null) => void
}

export function useDeleteActions({
  onDeselectNote,
  removeEntry,
  setToastMessage,
}: UseDeleteActionsInput) {
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null)

  const deleteNoteFromDisk = useCallback(async (path: string) => {
    try {
      if (isTauri()) await invoke('delete_note', { path })
      else await mockInvoke('delete_note', { path })
      onDeselectNote(path)
      removeEntry(path)
      return true
    } catch (e) {
      setToastMessage(`Failed to delete note: ${e}`)
      return false
    }
  }, [onDeselectNote, removeEntry, setToastMessage])

  const handleDeleteNote = useCallback(async (path: string) => {
    setConfirmDelete({
      title: 'Delete permanently?',
      message: 'Delete permanently? This cannot be undone. You can recover it from Git history.',
      onConfirm: async () => {
        setConfirmDelete(null)
        const ok = await deleteNoteFromDisk(path)
        if (ok) {
          trackEvent('note_deleted')
          setToastMessage('Note permanently deleted')
        }
      },
    })
  }, [deleteNoteFromDisk, setToastMessage])

  const handleBulkDeletePermanently = useCallback((paths: string[]) => {
    const count = paths.length
    setConfirmDelete({
      title: `Delete ${count} ${count === 1 ? 'note' : 'notes'} permanently?`,
      message: `${count === 1 ? 'This note' : `These ${count} notes`} will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDelete(null)
        let ok = 0
        for (const path of paths) {
          if (await deleteNoteFromDisk(path)) ok++
        }
        if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} permanently deleted`)
      },
    })
  }, [deleteNoteFromDisk, setToastMessage])

  return {
    confirmDelete,
    setConfirmDelete,
    deleteNoteFromDisk,
    handleDeleteNote,
    handleBulkDeletePermanently,
  }
}
