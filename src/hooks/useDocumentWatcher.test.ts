import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useDocumentWatcher } from './useDocumentWatcher'

const watch = vi.hoisted(() => ({ options: null as null | { vaultPaths: string[]; onVaultChanged: (paths: string[]) => Promise<void> } }))
vi.mock('./useVaultWatcher', () => ({ useVaultWatcher: (options: typeof watch.options) => { watch.options = options }, normalizeWatchPath: (path: string) => path }))

it('watches the Folder and outside Documents, refreshes the tree and reloads only clean changed Documents', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined)
  const reload = vi.fn().mockResolvedValue(undefined)
  const isPending = (path: string) => path === '/Notes/dirty.md'
  renderHook(() => useDocumentWatcher({
    folder: '/Notes', paths: ['/Notes/clean.md', '/Notes/dirty.md', '/Other/outside.md'], refresh, reload, isPending,
  }))
  expect(watch.options?.vaultPaths).toEqual(['/Notes', '/Other'])
  await act(async () => { await watch.options?.onVaultChanged(['/Notes/clean.md', '/Notes/dirty.md', '/Other/outside.md']) })
  expect(refresh).toHaveBeenCalledOnce()
  expect(reload.mock.calls.map(([path]) => path)).toEqual(['/Notes/clean.md', '/Other/outside.md'])
})
