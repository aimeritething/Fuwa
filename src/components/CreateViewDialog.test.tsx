import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CreateViewDialog } from './CreateViewDialog'
import type { ViewDefinition } from '../types'

describe('CreateViewDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
    availableFields: ['type', 'status', 'title'],
  }

  it('shows "Create View" title in create mode', () => {
    render(<CreateViewDialog {...defaultProps} />)
    expect(screen.getByText('Create View')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
  })

  it('shows "Edit View" title when editingView is provided', () => {
    const editingView: ViewDefinition = {
      name: 'Active Projects',
      icon: '🚀',
      color: null,
      sort: null,
      filters: { all: [{ field: 'type', op: 'equals', value: 'Project' }] },
    }
    render(<CreateViewDialog {...defaultProps} editingView={editingView} />)
    expect(screen.getByText('Edit View')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('pre-populates name field in edit mode', () => {
    const editingView: ViewDefinition = {
      name: 'Active Projects',
      icon: '🚀',
      color: null,
      sort: null,
      filters: { all: [{ field: 'type', op: 'equals', value: 'Project' }] },
    }
    render(<CreateViewDialog {...defaultProps} editingView={editingView} />)
    const input = screen.getByPlaceholderText(/Active Projects|Reading List/i)
    expect(input).toHaveValue('Active Projects')
  })
})
