import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkActionBar } from './BulkActionBar'

describe('BulkActionBar', () => {
  const defaultProps = {
    count: 3,
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  }

  it('shows Archive and Delete buttons in normal view', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByTestId('bulk-archive-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument()
  })

  it('shows selected count', () => {
    render(<BulkActionBar {...defaultProps} count={5} />)
    expect(screen.getByText('5 selected')).toBeInTheDocument()
  })

  it('shows Unarchive and Delete buttons in archived view', () => {
    render(<BulkActionBar {...defaultProps} isArchivedView={true} />)
    expect(screen.getByTestId('bulk-unarchive-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('bulk-archive-btn')).not.toBeInTheDocument()
  })

  it('calls onUnarchive when Unarchive button clicked in archived view', () => {
    const onUnarchive = vi.fn()
    render(<BulkActionBar {...defaultProps} isArchivedView={true} onUnarchive={onUnarchive} />)
    fireEvent.click(screen.getByTestId('bulk-unarchive-btn'))
    expect(onUnarchive).toHaveBeenCalledTimes(1)
  })
})
