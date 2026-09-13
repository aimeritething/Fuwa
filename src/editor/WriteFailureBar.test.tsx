import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WriteFailureBar } from './WriteFailureBar'

const PATH = '/Users/fuwa/Documents/Notes/Welcome.md'

describe('WriteFailureBar', () => {
  it('names the path that could not be written and shows what the boundary said', () => {
    render(<WriteFailureBar path={PATH} message="Permission denied (os error 13)" onRetry={vi.fn()} onDiscard={vi.fn()} />)

    const bar = screen.getByRole('alert')
    expect(bar).toHaveTextContent(`Couldn't save to ${PATH}`)
    expect(bar).toHaveTextContent('Permission denied (os error 13)')
  })

  it('offers Retry as the primary control and Discard changes as the secondary one', () => {
    const onRetry = vi.fn()
    const onDiscard = vi.fn()
    render(<WriteFailureBar path={PATH} message="Permission denied" onRetry={onRetry} onDiscard={onDiscard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onDiscard).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('data-variant', 'default')
    expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveAttribute('data-variant', 'secondary')
  })
})
