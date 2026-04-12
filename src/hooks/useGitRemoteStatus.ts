import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { GitRemoteStatus } from '../types'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

export interface GitRemoteState {
  remoteStatus: GitRemoteStatus | null
  refreshRemoteStatus: () => Promise<GitRemoteStatus | null>
}

async function readRemoteStatus(vaultPath: string): Promise<GitRemoteStatus> {
  return tauriCall<GitRemoteStatus>('git_remote_status', { vaultPath })
}

export function useGitRemoteStatus(vaultPath: string): GitRemoteState {
  const [remoteStatus, setRemoteStatus] = useState<GitRemoteStatus | null>(null)

  const refreshRemoteStatus = useCallback(async () => {
    try {
      const status = await readRemoteStatus(vaultPath)
      setRemoteStatus(status)
      return status
    } catch {
      setRemoteStatus(null)
      return null
    }
  }, [vaultPath])

  useEffect(() => {
    let cancelled = false

    async function loadRemoteStatus() {
      try {
        const status = await readRemoteStatus(vaultPath)
        if (!cancelled) setRemoteStatus(status)
      } catch {
        if (!cancelled) setRemoteStatus(null)
      }
    }

    void loadRemoteStatus()
    return () => {
      cancelled = true
    }
  }, [vaultPath])

  return { remoteStatus, refreshRemoteStatus }
}
