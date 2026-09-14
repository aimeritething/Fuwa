import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinderOpen } from './use-finder-open'

const { listenForOpenRequests, takePendingOpen } = vi.hoisted(() => ({
  listenForOpenRequests: vi.fn(),
  takePendingOpen: vi.fn(),
}))

vi.mock('./pending-open', () => ({ listenForOpenRequests, takePendingOpen }))

let poke: (() => void) | undefined
const unlisten = vi.fn()
/** Resolve to let the listener register; the hook drains only after this. */
let registerListener: () => void = () => {}

function pending(...batches: string[][]) {
  for (const batch of batches) takePendingOpen.mockResolvedValueOnce(batch)
  takePendingOpen.mockResolvedValue([])
}

function renderFinderOpen(options?: {
  ready?: boolean
  openNote?: (path: string) => Promise<void>
  settleActiveNote?: () => Promise<void>
}) {
  const openNote = options?.openNote ?? vi.fn(async () => {})
  const settleActiveNote = options?.settleActiveNote ?? vi.fn(async () => {})
  const hook = renderHook(
    ({ ready }: { ready: boolean }) => useFinderOpen({ openNote, settleActiveNote, ready }),
    { initialProps: { ready: options?.ready ?? true } },
  )
  return { ...hook, openNote, settleActiveNote }
}

describe('useFinderOpen', () => {
  beforeEach(() => {
    poke = undefined
    unlisten.mockClear()
    takePendingOpen.mockReset()
    takePendingOpen.mockResolvedValue([])
    listenForOpenRequests.mockReset()
    listenForOpenRequests.mockImplementation((onPoke: () => void) => new Promise<() => void>((resolve) => {
      poke = onPoke
      registerListener = () => resolve(unlisten)
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers the listener before the first drain, then opens what was buffered', async () => {
    pending(['/Users/fuwa/Notes/Plan.md'])
    const { openNote, result } = renderFinderOpen()

    await waitFor(() => expect(listenForOpenRequests).toHaveBeenCalledTimes(1))
    expect(takePendingOpen).not.toHaveBeenCalled()
    expect(result.current.settled).toBe(false)

    registerListener()

    await waitFor(() => expect(openNote).toHaveBeenCalledWith('/Users/fuwa/Notes/Plan.md'))
    expect(takePendingOpen).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.settled).toBe(true))
  })

  it('waits for the Session before draining, so the Folder is known and the Finder Document ends up active', async () => {
    pending(['/Users/fuwa/Notes/Plan.md'])
    const { openNote, rerender, result } = renderFinderOpen({ ready: false })
    registerListener()

    await waitFor(() => expect(listenForOpenRequests).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(takePendingOpen).not.toHaveBeenCalled()
    expect(result.current.settled).toBe(false)

    rerender({ ready: true })

    await waitFor(() => expect(openNote).toHaveBeenCalledWith('/Users/fuwa/Notes/Plan.md'))
    await waitFor(() => expect(result.current.settled).toBe(true))
  })

  it('settles with nothing to open, so the shell paints', async () => {
    const { openNote, result } = renderFinderOpen()
    registerListener()

    await waitFor(() => expect(result.current.settled).toBe(true))
    expect(takePendingOpen).toHaveBeenCalledTimes(1)
    expect(openNote).not.toHaveBeenCalled()
  })

  it('a poke while running drains the buffer rather than reading the payload', async () => {
    const { openNote } = renderFinderOpen()
    registerListener()
    await waitFor(() => expect(takePendingOpen).toHaveBeenCalledTimes(1))

    pending(['/Users/fuwa/Notes/Later.md'])
    poke?.()

    await waitFor(() => expect(openNote).toHaveBeenCalledWith('/Users/fuwa/Notes/Later.md'))
    expect(takePendingOpen).toHaveBeenCalledTimes(2)
  })

  it('a poke before the Session is back needs no bookkeeping: the first drain finds the paths', async () => {
    pending(['/Users/fuwa/Notes/Early.md'])
    const { openNote, rerender } = renderFinderOpen({ ready: false })
    registerListener()
    await waitFor(() => expect(listenForOpenRequests).toHaveBeenCalledTimes(1))

    poke?.()
    await Promise.resolve()
    expect(takePendingOpen).not.toHaveBeenCalled()

    rerender({ ready: true })

    await waitFor(() => expect(openNote).toHaveBeenCalledWith('/Users/fuwa/Notes/Early.md'))
    expect(takePendingOpen).toHaveBeenCalledTimes(1)
  })

  it('writes the active Document\'s pending edits first and opens every path in order, skipping non-Documents', async () => {
    pending(['/Users/fuwa/Notes/A.md', '/Users/fuwa/Desktop/shot.png', '/Users/fuwa/Notes/B.md'])
    const order: string[] = []
    const settleActiveNote = vi.fn(async () => {
      order.push('settle')
    })
    const openNote = vi.fn(async (path: string) => {
      order.push(path)
    })
    renderFinderOpen({ openNote, settleActiveNote })
    registerListener()

    await waitFor(() => expect(order).toEqual(['settle', '/Users/fuwa/Notes/A.md', '/Users/fuwa/Notes/B.md']))
  })

  it('a drain that fails is logged and still settles', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    takePendingOpen.mockRejectedValue(new Error('no such command'))
    const { result } = renderFinderOpen()
    registerListener()

    await waitFor(() => expect(result.current.settled).toBe(true))
    expect(warn).toHaveBeenCalledWith('[finder-open] Could not drain the pending opens:', expect.any(Error))
  })

  it('unlistens on unmount', async () => {
    const { unmount } = renderFinderOpen()
    registerListener()
    await waitFor(() => expect(takePendingOpen).toHaveBeenCalledTimes(1))

    unmount()

    await waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1))
  })
})
