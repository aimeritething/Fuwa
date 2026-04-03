import { useCallback, useState } from 'react'
import type { GitPushResult } from '../types'
import { trackEvent } from '../lib/telemetry'

interface CommitFlowConfig {
  savePending: () => Promise<void | boolean>
  loadModifiedFiles: () => Promise<void>
  commitAndPush: (message: string) => Promise<GitPushResult>
  setToastMessage: (msg: string | null) => void
  onPushRejected?: () => void
}

/** Manages the Commit & Push dialog state and the save→commit→push flow. */
export function useCommitFlow({ savePending, loadModifiedFiles, commitAndPush, setToastMessage, onPushRejected }: CommitFlowConfig) {
  const [showCommitDialog, setShowCommitDialog] = useState(false)

  const openCommitDialog = useCallback(async () => {
    await savePending()
    await loadModifiedFiles()
    setShowCommitDialog(true)
  }, [savePending, loadModifiedFiles])

  const handleCommitPush = useCallback(async (message: string) => {
    setShowCommitDialog(false)
    try {
      await savePending()
      const result = await commitAndPush(message)
      if (result.status === 'ok') {
        trackEvent('commit_made')
        setToastMessage('Committed and pushed')
      } else if (result.status === 'rejected') {
        setToastMessage('Committed, but push rejected — remote has new commits. Pull first.')
        onPushRejected?.()
      } else {
        setToastMessage(result.message)
      }
      loadModifiedFiles()
    } catch (err) {
      console.error('Commit failed:', err)
      setToastMessage(`Commit failed: ${err}`)
    }
  }, [savePending, commitAndPush, loadModifiedFiles, setToastMessage, onPushRejected])

  const closeCommitDialog = useCallback(() => setShowCommitDialog(false), [])

  return { showCommitDialog, openCommitDialog, handleCommitPush, closeCommitDialog }
}
