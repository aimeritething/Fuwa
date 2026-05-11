import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { ModifiedFile } from '../types'
import type { GitRepositoryOption } from '../utils/gitRepositories'
import { validGitRepositoryPath } from '../utils/gitRepositories'

interface RepositoryModifiedFiles {
  error: string | null
  files: ModifiedFile[]
}

interface UseGitRepositoriesOptions {
  defaultVaultPath: string
  repositories: GitRepositoryOption[]
}

const EMPTY_MODIFIED_FILES: RepositoryModifiedFiles = {
  error: null,
  files: [],
}

type RepositoryLoadIds = Map<string, number>

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

function withRepositoryPath(files: ModifiedFile[], vaultPath: string): ModifiedFile[] {
  return files.map((file) => ({ ...file, vaultPath }))
}

function modifiedFilesState(
  byRepository: Record<string, RepositoryModifiedFiles>,
  path: string,
): RepositoryModifiedFiles {
  return byRepository[path] ?? EMPTY_MODIFIED_FILES
}

function nextRepositoryLoadId(loadIds: RepositoryLoadIds, path: string): number {
  const nextId = (loadIds.get(path) ?? 0) + 1
  loadIds.set(path, nextId)
  return nextId
}

function isLatestRepositoryLoad(loadIds: RepositoryLoadIds, path: string, id: number): boolean {
  return loadIds.get(path) === id
}

function useValidatedRepositoryPath(
  repositories: GitRepositoryOption[],
  fallbackPath: string,
) {
  const [requestedPath, setRequestedPath] = useState(fallbackPath)
  const selectedPath = validGitRepositoryPath(requestedPath, repositories, fallbackPath)

  const setRepositoryPath = useCallback((path: string) => {
    setRequestedPath(path)
  }, [])

  return [selectedPath, setRepositoryPath] as const
}

function useRepositoryModifiedFiles(repositories: GitRepositoryOption[]) {
  const [byRepository, setByRepository] = useState<Record<string, RepositoryModifiedFiles>>({})
  const loadIdsRef = useRef<RepositoryLoadIds>(new Map())

  const loadModifiedFilesForRepository = useCallback(async (vaultPath: string) => {
    if (!vaultPath.trim()) return [] as ModifiedFile[]
    const loadId = nextRepositoryLoadId(loadIdsRef.current, vaultPath)

    try {
      const files = withRepositoryPath(
        await tauriCall<ModifiedFile[]>('get_modified_files', { vaultPath }),
        vaultPath,
      )
      if (isLatestRepositoryLoad(loadIdsRef.current, vaultPath, loadId)) {
        setByRepository((current) => ({ ...current, [vaultPath]: { error: null, files } }))
      }
      return files
    } catch (error) {
      const message = typeof error === 'string' ? error : 'Failed to load changes'
      if (isLatestRepositoryLoad(loadIdsRef.current, vaultPath, loadId)) {
        setByRepository((current) => ({ ...current, [vaultPath]: { error: message, files: [] } }))
      }
      return [] as ModifiedFile[]
    }
  }, [])

  const loadAllModifiedFiles = useCallback(async () => {
    await Promise.all(repositories.map((repository) => loadModifiedFilesForRepository(repository.path)))
  }, [loadModifiedFilesForRepository, repositories])

  useEffect(() => {
    if (repositories.length === 0) return
    void loadAllModifiedFiles()
  }, [loadAllModifiedFiles, repositories.length])

  return { byRepository, loadAllModifiedFiles, loadModifiedFilesForRepository }
}

export function useGitRepositories({
  defaultVaultPath,
  repositories,
}: UseGitRepositoriesOptions) {
  const [changesRepositoryPath, setChangesRepositoryPath] = useValidatedRepositoryPath(repositories, defaultVaultPath)
  const [historyRepositoryPath, setHistoryRepositoryPath] = useValidatedRepositoryPath(repositories, defaultVaultPath)
  const [commitRepositoryPath, setCommitRepositoryPath] = useValidatedRepositoryPath(repositories, defaultVaultPath)
  const { byRepository, loadAllModifiedFiles, loadModifiedFilesForRepository } = useRepositoryModifiedFiles(repositories)

  const allModifiedFiles = useMemo(
    () => repositories.flatMap((repository) => modifiedFilesState(byRepository, repository.path).files),
    [byRepository, repositories],
  )
  const changesState = modifiedFilesState(byRepository, changesRepositoryPath)
  const commitState = modifiedFilesState(byRepository, commitRepositoryPath)

  return {
    allModifiedFiles,
    changesModifiedFiles: changesState.files,
    changesModifiedFilesError: changesState.error,
    changesRepositoryPath,
    commitModifiedFiles: commitState.files,
    commitRepositoryPath,
    historyRepositoryPath,
    loadAllModifiedFiles,
    loadModifiedFilesForRepository,
    setChangesRepositoryPath,
    setCommitRepositoryPath,
    setHistoryRepositoryPath,
    totalModifiedCount: allModifiedFiles.length,
  }
}
