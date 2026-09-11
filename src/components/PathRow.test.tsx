import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PathRow } from './PathRow'

const imageSlot = { metadata: '1920 × 1080 · 240 KB', onOpenExternal: vi.fn(), onCopyPath: vi.fn() }

describe('PathRow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the file name and no save state before the first write', () => {
    render(<PathRow filename="Welcome.md" savedAt={null} />)

    expect(screen.getByText('Welcome.md')).toBeInTheDocument()
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument()
  })

  it('shows when the last write landed and keeps counting', () => {
    render(<PathRow filename="Welcome.md" savedAt={Date.now()} />)

    expect(screen.getByText('saved just now')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2_100)
    })

    expect(screen.getByText('saved 2s ago')).toBeInTheDocument()
  })

  it('restarts from "just now" when a later write lands', () => {
    const { rerender } = render(<PathRow filename="Welcome.md" savedAt={Date.now()} />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByText('saved 5s ago')).toBeInTheDocument()

    rerender(<PathRow filename="Welcome.md" savedAt={Date.now()} />)

    expect(screen.getByText('saved just now')).toBeInTheDocument()
  })

  it('replaces the save state on an Image Tab with its dimensions, size and two hand-offs', () => {
    render(<PathRow filename="lake.png" savedAt={Date.now()} image={imageSlot} />)

    expect(screen.getByTestId('path-row-image-meta')).toHaveTextContent('1920 × 1080 · 240 KB')
    expect(screen.queryByTestId('path-row-saved')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open ↗' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument()
  })

  it('keeps the metadata slot empty until the picture has loaded, buttons and all in place', () => {
    render(<PathRow filename="lake.png" savedAt={null} image={{ ...imageSlot, metadata: null }} />)

    expect(screen.queryByTestId('path-row-image-meta')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open ↗' })).toBeInTheDocument()
  })

  it('hands the file over from either button', () => {
    const onOpenExternal = vi.fn()
    const onCopyPath = vi.fn()
    render(<PathRow filename="lake.png" savedAt={null} image={{ metadata: null, onOpenExternal, onCopyPath }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open ↗' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }))

    expect(onOpenExternal).toHaveBeenCalledTimes(1)
    expect(onCopyPath).toHaveBeenCalledTimes(1)
  })
})
