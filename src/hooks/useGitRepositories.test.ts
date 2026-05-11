import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockInvoke } from '../mock-tauri'
import type { ModifiedFile } from '../types'
import { useGitRepositories } from './useGitRepositories'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  mockInvoke: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function modifiedFile(relativePath: string): ModifiedFile {
  return {
    path: `/default/${relativePath}`,
    relativePath,
    status: 'modified',
  }
}

describe('useGitRepositories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the newest modified-files refresh when older loads finish later', async () => {
    const firstLoad = deferred<ModifiedFile[]>()
    const secondLoad = deferred<ModifiedFile[]>()
    vi.mocked(mockInvoke)
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise)
    const repositories = [{ path: '/default', label: 'Default', defaultForNewNotes: true }]

    const { result } = renderHook(() => useGitRepositories({
      defaultVaultPath: '/default',
      repositories,
    }))

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1))

    await act(async () => {
      void result.current.loadModifiedFilesForRepository('/default')
    })
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(2))

    await act(async () => {
      secondLoad.resolve([modifiedFile('new.md')])
      await secondLoad.promise
    })
    expect(result.current.changesModifiedFiles.map((file) => file.relativePath)).toEqual(['new.md'])

    await act(async () => {
      firstLoad.resolve([modifiedFile('old.md')])
      await firstLoad.promise
    })
    expect(result.current.changesModifiedFiles.map((file) => file.relativePath)).toEqual(['new.md'])
  })
})
