import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBuilder } from './FilterBuilder'
import type { FilterGroup } from '../types'

describe('FilterBuilder value inputs', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderBuilder(group?: FilterGroup) {
    const defaultGroup: FilterGroup = {
      all: [{ field: 'title', op: 'contains', value: '' }],
    }
    return render(
      <FilterBuilder
        group={group ?? defaultGroup}
        onChange={onChange}
        availableFields={['type', 'status', 'title']}
      />,
    )
  }

  it('renders a plain text input for text operators', () => {
    renderBuilder()
    expect(screen.getByTestId('filter-value-input')).toBeInTheDocument()
    expect(screen.getByTestId('filter-value-input')).toHaveAttribute('placeholder', 'value')
  })

  it('renders a regex toggle for supported text operators', () => {
    renderBuilder()
    expect(screen.getByTestId('filter-regex-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('filter-regex-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps wikilink-style values in the plain text input without opening a dropdown', () => {
    renderBuilder({
      all: [{ field: 'belongs to', op: 'contains', value: '[[Alpha Project]]' }],
    })

    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)

    expect(input).toHaveValue('[[Alpha Project]]')
    expect(screen.queryByTestId('wikilink-dropdown')).not.toBeInTheDocument()
  })

  it('updates filter values as raw text strings', () => {
    renderBuilder()

    fireEvent.change(screen.getByTestId('filter-value-input'), {
      target: { value: 'plain text' },
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        all: [{ field: 'title', op: 'contains', value: 'plain text' }],
      }),
    )
  })

  it('toggles regex mode in the emitted filter payload', () => {
    renderBuilder()

    fireEvent.click(screen.getByTestId('filter-regex-toggle'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        all: [{ field: 'title', op: 'contains', value: '', regex: true }],
      }),
    )
  })

  it('shows an invalid-regex indicator when regex mode is enabled with a broken pattern', () => {
    renderBuilder({
      all: [{ field: 'title', op: 'contains', value: '(', regex: true }],
    })

    expect(screen.getByTestId('filter-regex-invalid')).toBeInTheDocument()
    expect(screen.getByTestId('filter-value-input')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('filter-regex-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not render a value input for empty-check operators', () => {
    renderBuilder({
      all: [{ field: 'title', op: 'is_empty' }],
    })

    expect(screen.queryByTestId('filter-value-input')).not.toBeInTheDocument()
    expect(screen.queryByTestId('filter-regex-toggle')).not.toBeInTheDocument()
  })

  it('renders calendar date picker button for date operators', () => {
    renderBuilder({
      all: [{ field: 'created', op: 'before', value: '2024-06-01' }],
    })

    expect(screen.getByTestId('date-value-input')).toHaveValue('2024-06-01')
    const dateButton = screen.getByTestId('date-picker-trigger')
    expect(dateButton).toBeInTheDocument()
    expect(dateButton).toHaveAttribute('title', 'Jun 1, 2024')
  })

  it('renders date picker placeholder when no date is selected', () => {
    renderBuilder({
      all: [{ field: 'created', op: 'after', value: '' }],
    })

    expect(screen.getByTestId('date-value-input')).toHaveValue('')
    expect(screen.getByTestId('date-picker-trigger')).toHaveAttribute('title', 'Pick a date')
    expect(screen.queryByTestId('filter-regex-toggle')).not.toBeInTheDocument()
  })

  it('allows free-text relative date phrases for date operators', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'))

    renderBuilder({
      all: [{ field: 'created', op: 'after', value: '10 days ago' }],
    })

    expect(screen.getByTestId('date-value-input')).toHaveValue('10 days ago')
    expect(screen.getByTestId('date-picker-trigger')).toHaveAttribute('title', 'Mar 28, 2026')
  })

  it('shows body field in field dropdown separated from property fields', () => {
    render(
      <FilterBuilder
        group={{ all: [{ field: 'body', op: 'contains', value: 'test' }] }}
        onChange={vi.fn()}
        availableFields={['type', 'status', 'body']}
      />,
    )

    expect(screen.getByText('body')).toBeInTheDocument()
  })
})
