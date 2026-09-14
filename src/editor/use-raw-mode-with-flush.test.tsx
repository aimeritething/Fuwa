import { renderHook, act } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorMode } from '@/types'
import { useRawModeWithFlush } from './use-raw-mode-with-flush'

const notePath = '/vault/project/test.md'
const originalContent = '# Test\n\nOriginal body\n'
const rawEditedContent = '# Test\n\nEdited in raw mode\n'

function makeEditor() {
  return {
    document: [],
    blocksToMarkdownLossy: vi.fn(() => originalContent),
  }
}

/** The hook over the per-Tab mode the app keeps in its Tab state. */
function useRawModeWithFlushOverTab(
  editor: ReturnType<typeof makeEditor>,
  onContentChange: (path: string, content: string) => void,
  flushPendingEditorChangeRef: { current: () => boolean },
) {
  const [mode, setModeState] = useState<EditorMode>('rich')
  const setMode = useCallback((_path: string, next: EditorMode) => setModeState(next), [])
  return useRawModeWithFlush(
    editor as never,
    notePath,
    originalContent,
    onContentChange,
    undefined,
    flushPendingEditorChangeRef,
    { mode, setMode },
  )
}

describe('use-raw-mode-with-flush', () => {
  it('re-enters raw mode with pending raw edits while tab state is still stale', async () => {
    const onContentChange = vi.fn()
    const flushPendingEditorChangeRef = { current: vi.fn(() => false) }
    const editor = makeEditor()
    const { result } = renderHook(() => useRawModeWithFlushOverTab(editor, onContentChange, flushPendingEditorChangeRef))

    await act(async () => {
      await result.current.handleToggleRaw()
    })
    expect(result.current.rawMode).toBe(true)
    act(() => {
      result.current.rawLatestContentRef.current = rawEditedContent
    })

    await act(async () => {
      await result.current.handleToggleRaw()
    })
    expect(result.current.rawMode).toBe(false)
    await act(async () => {
      await result.current.handleToggleRaw()
    })

    expect(onContentChange).toHaveBeenCalledWith(notePath, rawEditedContent)
    expect(result.current.rawLatestContentRef.current).toBe(rawEditedContent)
    expect(result.current.rawModeContentOverride).toEqual({
      path: notePath,
      content: rawEditedContent,
    })
  })
})
