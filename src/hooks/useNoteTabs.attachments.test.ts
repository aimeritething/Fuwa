import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteTabs } from './useNoteTabs'

const runtime = vi.hoisted(() => ({
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
  mockInvoke: () => Promise.reject(new Error('The mock Folder is not in play under Tauri')),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => runtime.invoke(cmd, args),
}))

describe('useNoteTabs Attachments', () => {
  beforeEach(() => {
    runtime.invoke.mockReset()
  })

  it('allows the Document\'s root before reading it, so its Attachments show on the first paint', async () => {
    const commands: string[] = []
    runtime.invoke.mockImplementation(async (cmd) => {
      commands.push(cmd)
      return cmd === 'get_note_content' ? '# Plan\n\n![](attachments/shot.png)\n' : undefined
    })
    const { result } = renderHook(() => useNoteTabs())

    await act(async () => {
      await result.current.openNote('/Users/fuwa/Notes/Plan.md')
    })

    expect(commands).toEqual(['sync_vault_asset_scope_for_window', 'get_note_content'])
    expect(runtime.invoke).toHaveBeenCalledWith('sync_vault_asset_scope_for_window', {
      vaultPath: '/Users/fuwa/Notes',
    })
  })

  it('opens the Document even when its root cannot be added to the asset scope', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runtime.invoke.mockImplementation(async (cmd) => {
      if (cmd === 'sync_vault_asset_scope_for_window') throw new Error('Failed to resolve asset scope')
      return '# Plan\n'
    })

    try {
      const { result } = renderHook(() => useNoteTabs())

      await act(async () => {
        await result.current.openNote('/Users/fuwa/Notes/Plan.md')
      })

      expect(result.current.activeTab?.content).toBe('# Plan\n')
    } finally {
      warn.mockRestore()
    }
  })
})
