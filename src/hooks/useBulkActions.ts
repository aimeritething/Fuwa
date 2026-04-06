import { useCallback } from 'react'

interface BulkEntryActions {
  handleArchiveNote: (path: string) => Promise<void>
}

export function useBulkActions(
  entryActions: BulkEntryActions,
  setToastMessage: (msg: string | null) => void,
) {
  const handleBulkArchive = useCallback(async (paths: string[]) => {
    let ok = 0
    for (const path of paths) {
      try { await entryActions.handleArchiveNote(path); ok++ }
      catch { /* error toast already shown by flushBeforeAction */ }
    }
    if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} archived`)
  }, [entryActions, setToastMessage])

  return { handleBulkArchive }
}
