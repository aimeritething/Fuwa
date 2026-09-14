import { act, render, screen } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  useCodeMirrorMock,
} = vi.hoisted(() => ({
  useCodeMirrorMock: vi.fn(),
}))

type CodeMirrorCallbacks = {
  onCursorActivity: (view: unknown) => void
  onDocChange: (doc: string) => void
  onEscape: () => boolean
  onSave: () => void
}

let latestCallbacks: CodeMirrorCallbacks | null = null
let latestViewRef: MutableRefObject<{
  dispatch: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  state: {
    doc: { toString: () => string }
    selection: { main: { head: number } }
  }
} | null>

vi.mock('@/kernel/raw/use-code-mirror', () => ({
  useCodeMirror: useCodeMirrorMock,
}))

import { RawEditorView } from './raw-editor-view'

const defaultProps = {
  content: '# Raw note',
  path: '/vault/raw-note.md',
  onContentChange: vi.fn(),
  onSave: vi.fn(),
}

function renderView(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  render(<RawEditorView {...props} />)
  return props
}

describe('RawEditorView additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()

    latestViewRef = {
      current: {
        dispatch: vi.fn(),
        focus: vi.fn(),
        state: {
          doc: { toString: () => 'Before' },
          selection: { main: { head: 6 } },
        },
      },
    }

    useCodeMirrorMock.mockImplementation((_container, _content, callbacks: CodeMirrorCallbacks) => {
      latestCallbacks = callbacks
      return latestViewRef
    })
  })

  it('debounces content updates, exposes latest content, flushes on save, and flushes pending edits on unmount', async () => {
    vi.useFakeTimers()
    const latestContentRef = { current: null as string | null }
    const onContentChange = vi.fn()
    const onSave = vi.fn()
    const { unmount } = render(
      <RawEditorView
        {...defaultProps}
        latestContentRef={latestContentRef}
        onContentChange={onContentChange}
        onSave={onSave}
      />,
    )

    expect(latestContentRef.current).toBe('# Raw note')

    act(() => {
      latestCallbacks?.onDocChange('draft 1')
      latestCallbacks?.onDocChange('draft 2')
    })

    expect(onContentChange).not.toHaveBeenCalled()
    expect(latestContentRef.current).toBe('draft 2')

    await act(async () => {
      vi.advanceTimersByTimeAsync(500)
    })

    expect(onContentChange).toHaveBeenCalledWith('/vault/raw-note.md', 'draft 2')

    act(() => {
      latestCallbacks?.onDocChange('draft 3')
      latestCallbacks?.onSave()
    })

    expect(onContentChange).toHaveBeenCalledWith('/vault/raw-note.md', 'draft 3')
    expect(onSave).toHaveBeenCalledTimes(1)

    act(() => {
      latestCallbacks?.onDocChange('draft 4')
    })

    unmount()

    expect(onContentChange).toHaveBeenCalledWith('/vault/raw-note.md', 'draft 4')
  })

  it('renders YAML errors from the parser result', () => {
    renderView({ content: '---\ntitle: Missing closing delimiter' })

    expect(screen.getByTestId('raw-editor-yaml-error')).toHaveTextContent('Unclosed frontmatter block')
  })

  it('reports escape handling only while the find bar is open', () => {
    renderView({ content: '# Raw note' })

    let escaped = true
    act(() => {
      escaped = latestCallbacks?.onEscape() ?? true
    })
    expect(escaped).toBe(false)
  })
})
