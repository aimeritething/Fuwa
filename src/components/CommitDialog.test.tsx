import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommitDialog } from './CommitDialog'

describe('CommitDialog', () => {
  const onCommit = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function getCommitButton() {
    // "Commit & Push" appears in both dialog title and button — use role to disambiguate
    return screen.getByRole('button', { name: 'Commit & Push' })
  }

  it('shows file count badge', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    expect(screen.getByText('3 files changed')).toBeInTheDocument()
  })

  it('shows singular file count', () => {
    render(<CommitDialog open={true} modifiedCount={1} onCommit={onCommit} onClose={onClose} />)
    expect(screen.getByText('1 file changed')).toBeInTheDocument()
  })

  it('disables Commit button when message is empty', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    expect(getCommitButton()).toBeDisabled()
  })

  it('enables Commit button when message is typed', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.change(textarea, { target: { value: 'fix: bug fix' } })
    expect(getCommitButton()).not.toBeDisabled()
  })

  it('calls onCommit with trimmed message on button click', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.change(textarea, { target: { value: '  fix: bug fix  ' } })
    fireEvent.click(getCommitButton())
    expect(onCommit).toHaveBeenCalledWith('fix: bug fix')
  })

  it('calls onCommit on Cmd+Enter', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.change(textarea, { target: { value: 'fix: test' } })
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    expect(onCommit).toHaveBeenCalledWith('fix: test')
  })

  it('calls onClose on Escape', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Cancel button click', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onCommit when message is whitespace only', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(getCommitButton())
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('renders nothing when not open', () => {
    const { container } = render(<CommitDialog open={false} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('pre-populates message with suggestedMessage', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha, beta" onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    expect(textarea).toHaveValue('Update alpha, beta')
  })

  it('enables Commit button when suggestedMessage is provided', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha" onCommit={onCommit} onClose={onClose} />)
    expect(getCommitButton()).not.toBeDisabled()
  })

  it('submits suggestedMessage on Cmd+Enter without user edits', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha" onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    expect(onCommit).toHaveBeenCalledWith('Update alpha')
  })

  it('allows user to edit the suggested message', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha" onCommit={onCommit} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Commit message...')
    fireEvent.change(textarea, { target: { value: 'fix: corrected typo in alpha' } })
    fireEvent.click(getCommitButton())
    expect(onCommit).toHaveBeenCalledWith('fix: corrected typo in alpha')
  })
})
