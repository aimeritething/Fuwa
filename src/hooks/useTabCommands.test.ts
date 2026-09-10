import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTabCommands } from './useTabCommands'

function renderCommands(activeTabPath: string | null) {
  const order: string[] = []
  const deps = {
    activeTabPath,
    settleActiveNote: vi.fn(async () => {
      order.push('settle')
    }),
    closeTab: vi.fn((path: string) => order.push(`close ${path}`)),
    activateTab: vi.fn((path: string) => order.push(`activate ${path}`)),
    activateTabAt: vi.fn((index: number) => order.push(`jump ${index}`)),
    activateAdjacentTab: vi.fn((direction: 1 | -1) => order.push(`adjacent ${direction}`)),
    closeWindow: vi.fn(async () => {
      order.push('close window')
    }),
  }
  const { result } = renderHook(() => useTabCommands(deps))
  return { commands: result.current, deps, order }
}

describe('useTabCommands', () => {
  it('⌘W writes pending edits, then closes the active Tab', async () => {
    const { commands, order } = renderCommands('/n/a.md')

    await act(async () => {
      commands.onCloseTab()
    })

    expect(order).toEqual(['settle', 'close /n/a.md'])
  })

  it('⌘W with zero Tabs closes the window', async () => {
    const { commands, deps, order } = renderCommands(null)

    await act(async () => {
      commands.onCloseTab()
    })

    expect(order).toEqual(['close window'])
    expect(deps.closeTab).not.toHaveBeenCalled()
  })

  it('moves between Tabs and jumps to Tab N after writing pending edits', async () => {
    const { commands, order } = renderCommands('/n/a.md')

    await act(async () => {
      commands.onPreviousTab()
      commands.onNextTab()
      commands.onJumpToTab2()
      commands.onJumpToTab9()
    })

    expect(order).toEqual(['settle', 'settle', 'settle', 'settle', 'adjacent -1', 'adjacent 1', 'jump 1', 'jump 8'])
  })

  it('activates and closes a Tab from the tab bar and Open Editors the same way', async () => {
    const { commands, order } = renderCommands('/n/a.md')

    await act(async () => {
      commands.activateTabSettled('/n/b.md')
      commands.closeTabSettled('/n/a.md')
    })

    expect(order).toEqual(['settle', 'settle', 'activate /n/b.md', 'close /n/a.md'])
  })

  it('still switches when the pending write fails, and logs it', async () => {
    const { commands, deps, order } = renderCommands('/n/a.md')
    deps.settleActiveNote.mockRejectedValueOnce(new Error('Permission denied'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      commands.onNextTab()
    })

    expect(order).toEqual(['adjacent 1'])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
