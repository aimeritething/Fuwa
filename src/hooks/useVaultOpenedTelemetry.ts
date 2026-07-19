import { invoke } from '@tauri-apps/api/core'
import { useEffect, useRef } from 'react'
import { trackEvent } from '../lib/telemetry'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { GitRootRelation, GitWorkspaceInfo } from '../types'
import type { GitRepoState } from './useGitSetupState'

interface UseVaultOpenedTelemetryArgs {
  entryCount: number
  gitRepoState: GitRepoState
  resolvedPath: string
}

function shouldTrackVaultOpened(
  entryCount: number,
  gitRepoState: GitRepoState,
  resolvedPath: string,
  previousPath: string,
): boolean {
  const hasEntries = entryCount > 0
  const gitStateKnown = gitRepoState !== 'checking'
  const vaultChanged = resolvedPath !== previousPath

  return hasEntries && gitStateKnown && vaultChanged
}

export function useVaultOpenedTelemetry({
  entryCount,
  gitRepoState,
  resolvedPath,
}: UseVaultOpenedTelemetryArgs): void {
  const vaultOpenedRef = useRef('')

  useEffect(() => {
    if (!shouldTrackVaultOpened(entryCount, gitRepoState, resolvedPath, vaultOpenedRef.current)) return

    vaultOpenedRef.current = resolvedPath
    const trackVault = async () => {
      const workspace = await loadWorkspaceInfo(resolvedPath, gitRepoState)
      trackEvent('vault_opened', {
        git_root_relation: workspace.relation,
        has_git: gitRepoState === 'ready' ? 1 : 0,
        note_count: entryCount,
      })
      if (workspace.failure) {
        trackEvent('git_root_resolution_failed', { reason: workspace.failure })
      }
    }
    void trackVault()
  }, [entryCount, gitRepoState, resolvedPath])
}

async function loadWorkspaceInfo(
  resolvedPath: string,
  gitRepoState: GitRepoState,
): Promise<{ failure: string | null; relation: GitRootRelation }> {
  if (gitRepoState !== 'ready') return { failure: null, relation: 'none' }
  try {
    const info = isTauri()
      ? await invoke<GitWorkspaceInfo>('git_workspace_info', { vaultPath: resolvedPath })
      : await mockInvoke<GitWorkspaceInfo>('git_workspace_info', { vaultPath: resolvedPath })
    return {
      failure: info?.resolutionFailure ?? null,
      relation: info?.gitRootRelation ?? 'none',
    }
  } catch {
    return { failure: 'command_failed', relation: 'none' }
  }
}
