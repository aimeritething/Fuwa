import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GitPushResult, GitRemoteStatus } from '../types'
import { trackEvent } from '../lib/telemetry'
import { isTauri, mockInvoke } from '../mock-tauri'

export type CommitMode = 'push' | 'local'

interface LocalCommitResult {
  status: 'local_only'
  message: string
}

type CommitResult = GitPushResult | LocalCommitResult

interface CommitFlowConfig {
  savePending: () => Promise<void | boolean>
  loadModifiedFiles: () => Promise<void>
  resolveRemoteStatus: () => Promise<GitRemoteStatus | null>
  setToastMessage: (msg: string | null) => void
  onPushRejected?: () => void
  vaultPath: string
}

function commitModeFromRemoteStatus(remoteStatus: GitRemoteStatus | null): CommitMode {
  return remoteStatus?.hasRemote === false ? 'local' : 'push'
}

async function commitLocally(vaultPath: string, message: string): Promise<void> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { vaultPath, message })
    return
  }

  await invoke<string>('git_commit', { vaultPath, message })
}

async function pushCommittedChanges(vaultPath: string): Promise<GitPushResult> {
  if (!isTauri()) {
    return mockInvoke<GitPushResult>('git_push', { vaultPath })
  }

  return invoke<GitPushResult>('git_push', { vaultPath })
}

async function executeCommitAction(vaultPath: string, message: string, commitMode: CommitMode): Promise<CommitResult> {
  await commitLocally(vaultPath, message)
  if (commitMode === 'local') {
    return { status: 'local_only', message: 'Committed locally (no remote configured)' }
  }

  return pushCommittedChanges(vaultPath)
}

function commitToastMessage(result: CommitResult): string {
  if (result.status === 'ok') return 'Committed and pushed'
  if (result.status === 'local_only') return result.message
  if (result.status === 'rejected') return 'Committed, but push rejected — remote has new commits. Pull first.'
  return result.message
}

function isPushRejected(result: CommitResult): boolean {
  return result.status === 'rejected'
}

function formatCommitError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Manages the commit dialog state and the save→commit→push/local flow. */
export function useCommitFlow({
  savePending,
  loadModifiedFiles,
  resolveRemoteStatus,
  setToastMessage,
  onPushRejected,
  vaultPath,
}: CommitFlowConfig) {
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [commitMode, setCommitMode] = useState<CommitMode>('push')

  const openCommitDialog = useCallback(async () => {
    await savePending()
    await loadModifiedFiles()
    const remoteStatus = await resolveRemoteStatus()
    setCommitMode(commitModeFromRemoteStatus(remoteStatus))
    setShowCommitDialog(true)
  }, [loadModifiedFiles, resolveRemoteStatus, savePending])

  const handleCommitPush = useCallback(async (message: string) => {
    setShowCommitDialog(false)
    try {
      await savePending()
      const remoteStatus = await resolveRemoteStatus()
      const nextCommitMode = commitModeFromRemoteStatus(remoteStatus)
      const result = await executeCommitAction(vaultPath, message, nextCommitMode)

      trackEvent('commit_made')
      setToastMessage(commitToastMessage(result))
      if (isPushRejected(result)) {
        onPushRejected?.()
      }

      await loadModifiedFiles()
      await resolveRemoteStatus()
    } catch (err) {
      console.error('Commit failed:', err)
      setToastMessage(`Commit failed: ${formatCommitError(err)}`)
    }
  }, [loadModifiedFiles, onPushRejected, resolveRemoteStatus, savePending, setToastMessage, vaultPath])

  const closeCommitDialog = useCallback(() => setShowCommitDialog(false), [])

  return { showCommitDialog, commitMode, openCommitDialog, handleCommitPush, closeCommitDialog }
}
