import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDocumentDrop } from './useDocumentDrop'

let tauriMode = true

type CapturedDragDropHandler = (event: { payload: unknown }) => void

let capturedDragDropHandler: CapturedDragDropHandler | undefined
const onDragDropEvent = vi.fn((handler: CapturedDragDropHandler) => {
  capturedDragDropHandler = handler
  return Promise.resolve(vi.fn())
})

vi.mock('@/platform/tauri', () => ({
  isTauri: () => tauriMode,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onDragDropEvent }),
}))

function dropPayload(paths: string[]) {
  return { type: 'drop', paths, position: { x: 12, y: 34 } }
}

async function renderDocumentDrop(options?: {
  openNote?: (path: string) => Promise<void>
  settleActiveNote?: () => Promise<void>
}) {
  const openNote = options?.openNote ?? vi.fn(async () => {})
  const settleActiveNote = options?.settleActiveNote ?? vi.fn(async () => {})
  renderHook(() => useDocumentDrop({ openNote, settleActiveNote }))
  await waitFor(() => {
    expect(capturedDragDropHandler).toBeDefined()
  })
  return { openNote, settleActiveNote }
}

function emit(payload: unknown): void {
  if (!capturedDragDropHandler) throw new Error('No native drag-drop handler registered')
  capturedDragDropHandler({ payload })
}

describe('useDocumentDrop', () => {
  beforeEach(() => {
    tauriMode = true
    capturedDragDropHandler = undefined
    onDragDropEvent.mockClear()
  })

  afterEach(() => {
    tauriMode = false
    capturedDragDropHandler = undefined
  })

  it('opens a dropped Document', async () => {
    const { openNote } = await renderDocumentDrop()

    emit(dropPayload(['/Users/fuwa/Notes/Plan.md']))

    await waitFor(() => {
      expect(openNote).toHaveBeenCalledWith('/Users/fuwa/Notes/Plan.md')
    })
  })

  it('writes the active Document\'s pending edits before opening the dropped one', async () => {
    const order: string[] = []
    const settleActiveNote = vi.fn(async () => {
      order.push('settle')
    })
    const openNote = vi.fn(async () => {
      order.push('open')
    })
    await renderDocumentDrop({ openNote, settleActiveNote })

    emit(dropPayload(['/Users/fuwa/Notes/Plan.md']))

    await waitFor(() => {
      expect(order).toEqual(['settle', 'open'])
    })
  })

  it('opens the dropped Document even when the pending write is refused', async () => {
    const settleActiveNote = vi.fn(async () => {
      throw new Error('Read-only file system')
    })
    const { openNote } = await renderDocumentDrop({ settleActiveNote })

    emit(dropPayload(['/Users/fuwa/Notes/Plan.md']))

    await waitFor(() => {
      expect(openNote).toHaveBeenCalledWith('/Users/fuwa/Notes/Plan.md')
    })
  })

  it('ignores a dropped file that is not a Document', async () => {
    const { openNote, settleActiveNote } = await renderDocumentDrop()

    emit(dropPayload(['/Users/fuwa/Desktop/notes.txt', '/Users/fuwa/Desktop/shot.png']))

    await Promise.resolve()
    expect(openNote).not.toHaveBeenCalled()
    expect(settleActiveNote).not.toHaveBeenCalled()
  })

  it('opens every dropped Document, in the order the drop carried them', async () => {
    const opened: string[] = []
    const openNote = vi.fn(async (path: string) => {
      opened.push(path)
    })
    await renderDocumentDrop({ openNote })

    emit(dropPayload(['/Users/fuwa/Notes/A.md', '/Users/fuwa/Desktop/shot.png', '/Users/fuwa/Notes/B.md']))

    await waitFor(() => {
      expect(opened).toEqual(['/Users/fuwa/Notes/A.md', '/Users/fuwa/Notes/B.md'])
    })
  })

  it('keeps opening the rest when one dropped Document cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const opened: string[] = []
    const openNote = vi.fn(async (path: string) => {
      if (path.endsWith('A.md')) throw new Error('File does not exist')
      opened.push(path)
    })
    await renderDocumentDrop({ openNote })

    try {
      emit(dropPayload(['/Users/fuwa/Notes/A.md', '/Users/fuwa/Notes/B.md']))

      await waitFor(() => {
        expect(opened).toEqual(['/Users/fuwa/Notes/B.md'])
      })
    } finally {
      error.mockRestore()
    }
  })

  it('ignores the drag events that carry no drop', async () => {
    const { openNote } = await renderDocumentDrop()

    emit({ type: 'enter', paths: ['/Users/fuwa/Notes/Plan.md'], position: { x: 1, y: 2 } })
    emit({ type: 'leave' })

    await Promise.resolve()
    expect(openNote).not.toHaveBeenCalled()
  })
})
