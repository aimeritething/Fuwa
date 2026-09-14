import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MutableRefObject } from 'react'

const {
  useCodeMirrorMock,
  viewRefState,
} = vi.hoisted(() => ({
  useCodeMirrorMock: vi.fn(),
  viewRefState: { current: null as null | Record<string, unknown> },
}))

vi.mock('@/kernel/raw/use-code-mirror', () => ({
  useCodeMirror: useCodeMirrorMock,
}))

import { RawEditorView } from './raw-editor-view'
import { insertPlainTextFromClipboardText } from './plain-text-paste'

function createMockView(docText = 'Alpha Beta') {
  return {
    state: {
      doc: { toString: () => docText },
      selection: { main: { head: docText.length } },
      replaceSelection: vi.fn((text: string) => ({
        changes: { from: 2, to: 5, insert: text },
        selection: { anchor: 2 + text.length },
      })),
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  }
}

describe('RawEditorView behavior coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    viewRefState.current = createMockView()
    useCodeMirrorMock.mockImplementation((_containerRef: unknown, _content: string, callbacks: unknown) => {
      useCodeMirrorMock.mock.calls[useCodeMirrorMock.mock.calls.length - 1]![2] = callbacks
      return viewRefState
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces content changes, exposes the latest content ref, flushes saves, and cleans up on unmount', () => {
    const onContentChange = vi.fn()
    const onSave = vi.fn()
    const latestContentRef = { current: null } as MutableRefObject<string | null>

    const { rerender, unmount } = render(
      <RawEditorView
        content="---\ntitle: Start\n---"
        path="/vault/a.md"
        onContentChange={onContentChange}
        onSave={onSave}
        latestContentRef={latestContentRef}
      />,
    )

    const callbacks = useCodeMirrorMock.mock.calls[0]![2] as {
      onDocChange: (doc: string) => void
      onSave: () => void
    }

    act(() => {
      callbacks.onDocChange('---\ntitle: broken')
    })

    expect(latestContentRef.current).toBe('---\ntitle: broken')
    expect(screen.getByTestId('raw-editor-yaml-error')).toHaveTextContent('Unclosed frontmatter')

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onContentChange).toHaveBeenCalledWith('/vault/a.md', '---\ntitle: broken')

    rerender(
      <RawEditorView
        content="fixed"
        path="/vault/b.md"
        onContentChange={onContentChange}
        onSave={onSave}
        latestContentRef={latestContentRef}
      />,
    )

    act(() => {
      callbacks.onDocChange('pending change')
      callbacks.onSave()
    })

    expect(onContentChange).toHaveBeenLastCalledWith('/vault/b.md', 'pending change')
    expect(onSave).toHaveBeenCalledTimes(1)

    act(() => {
      callbacks.onDocChange('flush on unmount')
    })
    unmount()

    expect(onContentChange).toHaveBeenLastCalledWith('/vault/b.md', 'flush on unmount')
  })

  it('handles registered plain-text paste requests with CodeMirror selection replacement', () => {
    const mockView = createMockView('Alpha Beta')
    viewRefState.current = mockView

    render(
      <RawEditorView
        content="Alpha Beta"
        path="/vault/a.md"
        onContentChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    fireEvent.focus(screen.getByTestId('raw-editor-codemirror'))

    expect(insertPlainTextFromClipboardText('Plain\nText')).toBe(true)
    expect(mockView.state.replaceSelection).toHaveBeenCalledWith('Plain\nText')
    expect(mockView.dispatch).toHaveBeenCalledWith({
      changes: { from: 2, to: 5, insert: 'Plain\nText' },
      selection: { anchor: 12 },
      userEvent: 'input.paste',
    })
    expect(mockView.focus).toHaveBeenCalledOnce()
  })

})
