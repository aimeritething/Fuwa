import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterFieldCombobox } from '../FilterFieldCombobox'

describe('FilterFieldCombobox', () => {
  it('renders its option list outside the clipped field container', () => {
    render(
      <div className="h-12 overflow-hidden">
        <FilterFieldCombobox value="status" fields={['status', 'title', 'Owner']} onChange={vi.fn()} />
      </div>,
    )

    const root = screen.getByTestId('filter-field-combobox')
    const input = screen.getByTestId('filter-field-combobox-input')

    fireEvent.focus(input)

    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(root.contains(listbox)).toBe(false)
  })
})
