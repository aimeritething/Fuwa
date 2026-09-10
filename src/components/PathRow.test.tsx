import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PathRow } from './PathRow'

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
})
