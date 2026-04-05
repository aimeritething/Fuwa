import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBuilder } from './FilterBuilder'
import type { FilterGroup, VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  ...overrides,
})

const entries: VaultEntry[] = [
  makeEntry({ path: '/vault/project/alpha.md', filename: 'alpha.md', title: 'Alpha Project', isA: 'Project' }),
  makeEntry({ path: '/vault/person/luca.md', filename: 'luca.md', title: 'Luca', isA: 'Person' }),
  makeEntry({ path: '/vault/topic/ai.md', filename: 'ai.md', title: 'AI Research', isA: 'Topic' }),
  makeEntry({ path: '/vault/note/plain.md', filename: 'plain.md', title: 'Plain Note', isA: null }),
  makeEntry({ path: '/vault/person/alice.md', filename: 'alice.md', title: 'Alice Smith', isA: 'Person', aliases: ['Alice'] }),
  makeEntry({ path: '/vault/trashed.md', filename: 'trashed.md', title: 'Trashed Note', isA: null, trashed: true }),
]

describe('FilterBuilder wikilink autocomplete', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderWithEntries(group?: FilterGroup) {
    const defaultGroup: FilterGroup = {
      all: [{ field: 'title', op: 'contains', value: '' }],
    }
    return render(
      <FilterBuilder
        group={group ?? defaultGroup}
        onChange={onChange}
        availableFields={['type', 'status', 'title']}
        entries={entries}
      />,
    )
  }

  it('renders value input with wikilink support when entries are provided', () => {
    renderWithEntries()
    expect(screen.getByTestId('filter-value-input')).toBeInTheDocument()
  })

  it('does not show dropdown for plain text input', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: 'hello' }],
    })
    expect(screen.queryByTestId('wikilink-dropdown')).not.toBeInTheDocument()
  })

  it('shows dropdown when value starts with [[', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Al' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    expect(screen.getByTestId('wikilink-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Alpha Project')).toBeInTheDocument()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('does not show dropdown for short queries after [[', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[A' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    expect(screen.queryByTestId('wikilink-dropdown')).not.toBeInTheDocument()
  })

  it('inserts [[note-title]] when a note is selected', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Alpha' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    fireEvent.click(screen.getByText('Alpha Project'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        all: [{ field: 'title', op: 'contains', value: '[[Alpha Project]]' }],
      }),
    )
  })

  it('navigates dropdown with arrow keys and selects with Enter', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Al' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const selected = document.querySelector('.wikilink-menu__item--selected')
    expect(selected).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalled()
  })

  it('closes dropdown on Escape', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Al' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    expect(screen.getByTestId('wikilink-dropdown')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('wikilink-dropdown')).not.toBeInTheDocument()
  })

  it('excludes trashed notes from autocomplete', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Trashed' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    expect(screen.queryByText('Trashed Note')).not.toBeInTheDocument()
  })

  it('matches on aliases', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Alice' }],
    })
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('shows type badge for typed entries', () => {
    const personType = makeEntry({
      path: '/vault/person.md', filename: 'person.md', title: 'Person',
      isA: 'Type', color: 'yellow', icon: 'user',
    })
    const entriesWithType = [...entries, personType]
    render(
      <FilterBuilder
        group={{ all: [{ field: 'title', op: 'contains', value: '[[Luca' }] }}
        onChange={onChange}
        availableFields={['type', 'status', 'title']}
        entries={entriesWithType}
      />,
    )
    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)
    expect(screen.getByText('Person')).toBeInTheDocument()
  })

  it('opens dropdown on typing [[ in input', () => {
    renderWithEntries({
      all: [{ field: 'title', op: 'contains', value: '[[Al' }],
    })
    const input = screen.getByTestId('filter-value-input')
    // Simulate the user typing [[ — dropdown opens when value starts with [[
    fireEvent.change(input, { target: { value: '[[Al' } })
    // The internal open state is set by onChange, verified via focus re-trigger
    fireEvent.focus(input)
    expect(screen.getByTestId('wikilink-dropdown')).toBeInTheDocument()
  })

  it('plain text without [[ still works as regular input', () => {
    renderWithEntries()
    const input = screen.getByTestId('filter-value-input')
    fireEvent.change(input, { target: { value: 'some text' } })
    expect(screen.queryByTestId('wikilink-dropdown')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalled()
  })

  it('falls back to plain input when no entries are provided', () => {
    render(
      <FilterBuilder
        group={{ all: [{ field: 'title', op: 'contains', value: '' }] }}
        onChange={onChange}
        availableFields={['type', 'status', 'title']}
      />,
    )
    const input = screen.getByPlaceholderText('value')
    expect(input).toBeInTheDocument()
    expect(input).not.toHaveAttribute('data-testid', 'filter-value-input')
  })

  it('renders calendar date picker button for date operators', () => {
    renderWithEntries({
      all: [{ field: 'created', op: 'before', value: '2024-06-01' }],
    })
    const dateButton = screen.getByTestId('date-picker-trigger')
    expect(dateButton).toBeInTheDocument()
    expect(dateButton).toHaveTextContent('Jun 1, 2024')
    // Should NOT have a native input type="date"
    expect(screen.queryByDisplayValue('2024-06-01')).not.toBeInTheDocument()
  })

  it('renders date picker placeholder when no date is selected', () => {
    renderWithEntries({
      all: [{ field: 'created', op: 'after', value: '' }],
    })
    const dateButton = screen.getByTestId('date-picker-trigger')
    expect(dateButton).toHaveTextContent('Pick a date')
  })

  it('shows body field in field dropdown separated from property fields', () => {
    render(
      <FilterBuilder
        group={{ all: [{ field: 'body', op: 'contains', value: 'test' }] }}
        onChange={vi.fn()}
        availableFields={['type', 'status', 'body']}
      />,
    )
    // Body field should be selected as the current value
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})
