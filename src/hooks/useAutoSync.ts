import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { GitPullResult, GitPushResult, GitRemoteStatus, LastCommitInfo, SyncStatus } from '../types'

const DEFAULT_INTERVAL_MS = 5 * 60_000

function tauriCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

interface UseAutoSyncOptions {
  vaultPath: string
  intervalMinutes: number | null
  onVaultUpdated: () => void
  onSyncUpdated?: () => void
  onConflict: (files: string[]) => void
  onToast: (msg: string) => void
}

export interface AutoSyncState {
  syncStatus: SyncStatus
  lastSyncTime: number | null
  conflictFiles: string[]
  lastCommitInfo: LastCommitInfo | null
  remoteStatus: GitRemoteStatus | null
  triggerSync: () => void
  /** Pull from remote, then push if there are local commits ahead. */
  pullAndPush: () => void
  /** Pause auto-pull (e.g. while conflict resolver modal is open). */
  pausePull: () => void
  /** Resume auto-pull after pausing. */
  resumePull: () => void
  /** Notify that a push was rejected so the status updates to pull_required. */
  handlePushRejected: () => void
}

export function useAutoSync({
  vaultPath,
  intervalMinutes,
  onVaultUpdated,
  onSyncUpdated,
  onConflict,
  onToast,
}: UseAutoSyncOptions): AutoSyncState {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [conflictFiles, setConflictFiles] = useState<string[]>([])
  const [lastCommitInfo, setLastCommitInfo] = useState<LastCommitInfo | null>(null)
  const [remoteStatus, setRemoteStatus] = useState<GitRemoteStatus | null>(null)
  const syncingRef = useRef(false)
  const pauseRef = useRef(false)
  const callbacksRef = useRef({ onVaultUpdated, onSyncUpdated, onConflict, onToast })
  callbacksRef.current = { onVaultUpdated, onSyncUpdated, onConflict, onToast }

  const refreshRemoteStatus = useCallback(async () => {
    try {
      const status = await tauriCall<GitRemoteStatus>('git_remote_status', { vaultPath })
      setRemoteStatus(status)
      return status
    } catch {
      return null
    }
  }, [vaultPath])

  /** Check for pre-existing conflicts (e.g. from a prior session or interrupted rebase). */
  const checkExistingConflicts = useCallback(async (): Promise<boolean> => {
    try {
      const files = await tauriCall<string[]>('get_conflict_files', { vaultPath })
      if (files.length > 0) {
        setSyncStatus('conflict')
        setConflictFiles(files)
        callbacksRef.current.onConflict(files)
        return true
      }
    } catch {
      // If the command doesn't exist (e.g. browser mock), ignore
    }
    return false
  }, [vaultPath])

  const refreshCommitInfo = useCallback(() => {
    tauriCall<LastCommitInfo | null>('get_last_commit_info', { vaultPath })
      .then(info => setLastCommitInfo(info))
      .catch(() => {})
  }, [vaultPath])

  const performPull = useCallback(async () => {
    if (syncingRef.current || pauseRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')

    try {
      const result = await tauriCall<GitPullResult>('git_pull', { vaultPath })
      setLastSyncTime(Date.now())
      refreshCommitInfo()

      if (result.status === 'updated') {
        setSyncStatus('idle')
        setConflictFiles([])
        callbacksRef.current.onVaultUpdated()
        callbacksRef.current.onSyncUpdated?.()
        callbacksRef.current.onToast(`Pulled ${result.updatedFiles.length} update(s) from remote`)
      } else if (result.status === 'conflict') {
        setSyncStatus('conflict')
        setConflictFiles(result.conflictFiles)
        callbacksRef.current.onConflict(result.conflictFiles)
      } else if (result.status === 'error') {
        // Pull failed — check if there are pre-existing conflicts that caused it
        const hasConflicts = await checkExistingConflicts()
        if (!hasConflicts) {
          setSyncStatus('error')
        }
      } else {
        // up_to_date or no_remote
        setSyncStatus('idle')
        setConflictFiles([])
      }

      // Refresh remote status after pull
      refreshRemoteStatus()
    } catch {
      setSyncStatus('error')
      setLastSyncTime(Date.now())
    } finally {
      syncingRef.current = false
    }
  }, [vaultPath, checkExistingConflicts, refreshCommitInfo, refreshRemoteStatus])

  /** Pull from remote, then auto-push if successful. Used for divergence recovery. */
  const pullAndPush = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')

    try {
      const pullResult = await tauriCall<GitPullResult>('git_pull', { vaultPath })
      setLastSyncTime(Date.now())
      refreshCommitInfo()

      if (pullResult.status === 'conflict') {
        setSyncStatus('conflict')
        setConflictFiles(pullResult.conflictFiles)
        callbacksRef.current.onConflict(pullResult.conflictFiles)
        return
      }

      if (pullResult.status === 'error') {
        const hasConflicts = await checkExistingConflicts()
        if (!hasConflicts) {
          setSyncStatus('error')
          callbacksRef.current.onToast('Pull failed: ' + pullResult.message)
        }
        return
      }

      if (pullResult.status === 'updated') {
        callbacksRef.current.onVaultUpdated()
        callbacksRef.current.onSyncUpdated?.()
      }

      // Now push
      const pushResult = await tauriCall<GitPushResult>('git_push', { vaultPath })
      if (pushResult.status === 'ok') {
        setSyncStatus('idle')
        setConflictFiles([])
        callbacksRef.current.onToast('Pulled and pushed successfully')
      } else if (pushResult.status === 'rejected') {
        // Still diverged — shouldn't happen after pull but handle gracefully
        setSyncStatus('pull_required')
        callbacksRef.current.onToast('Push still rejected after pull — try again')
      } else {
        setSyncStatus('error')
        callbacksRef.current.onToast(pushResult.message)
      }

      refreshRemoteStatus()
    } catch {
      setSyncStatus('error')
      setLastSyncTime(Date.now())
    } finally {
      syncingRef.current = false
    }
  }, [vaultPath, checkExistingConflicts, refreshCommitInfo, refreshRemoteStatus])

  const handlePushRejected = useCallback(() => {
    setSyncStatus('pull_required')
  }, [])

  // Check for pre-existing conflicts on mount, then pull
  useEffect(() => {
    checkExistingConflicts().then(hasConflicts => {
      if (!hasConflicts) performPull()
    })
    refreshRemoteStatus()
  }, [checkExistingConflicts, performPull, refreshRemoteStatus])

  // Pull on window focus (app foreground)
  useEffect(() => {
    const handleFocus = () => { performPull() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [performPull])

  // Periodic pull
  useEffect(() => {
    const ms = (intervalMinutes ?? 5) * 60_000 || DEFAULT_INTERVAL_MS
    const id = setInterval(performPull, ms)
    return () => clearInterval(id)
  }, [performPull, intervalMinutes])

  const pausePull = useCallback(() => { pauseRef.current = true }, [])
  const resumePull = useCallback(() => { pauseRef.current = false }, [])

  return { syncStatus, lastSyncTime, conflictFiles, lastCommitInfo, remoteStatus, triggerSync: performPull, pullAndPush, pausePull, resumePull, handlePushRejected }
}
