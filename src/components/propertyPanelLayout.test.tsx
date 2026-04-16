import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
import { DynamicRelationshipsPanel } from './InspectorPanels'
import type { VaultEntry } from '../types'

const entry: VaultEntry = {
  path: '/vault/note.md',
  filename: 'note.md',
  title: 'Note',
  isA: 'Project',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 0,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  properties: {},
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  hasH1: false,
  outgoingLinks: [],
  sidebarLabel: null,
}

describe('property panel shared grid layout', () => {
  it('uses a shared fit-content column grid with subgridded rows', () => {
    render(
      <DynamicPropertiesPanel
        entry={entry}
        frontmatter={{ VeryLongPropertyName: 'Value', Status: 'Active' }}
        onUpdateProperty={vi.fn()}
      />
    )

    const typeRow = screen.getByTestId('type-selector')
    const layoutGrid = typeRow.parentElement

    expect(layoutGrid).not.toBeNull()
    expect(layoutGrid?.style.gridTemplateColumns).toBe('fit-content(50%) minmax(0, 1fr)')
    expect(typeRow.style.gridTemplateColumns).toBe('subgrid')
    expect(typeRow.style.gridColumn).toBe('1 / -1')

    screen.getAllByTestId('editable-property').forEach((row) => {
      expect(row.style.gridTemplateColumns).toBe('subgrid')
      expect(row.style.gridColumn).toBe('1 / -1')
    })
  })

  it('keeps suggested property rows on the shared grid', () => {
    render(
      <DynamicPropertiesPanel
        entry={entry}
        frontmatter={{}}
        onAddProperty={vi.fn()}
      />
    )

    screen.getAllByTestId('suggested-property').forEach((row) => {
      expect(row.style.gridTemplateColumns).toBe('subgrid')
      expect(row.style.gridColumn).toBe('1 / -1')
    })
  })

  it('keeps the add-property row on the shared grid', () => {
    render(
      <DynamicPropertiesPanel
        entry={entry}
        frontmatter={{}}
        onAddProperty={vi.fn()}
      />
    )

    const row = screen.getByTestId('add-property-row')
    expect(row.style.gridTemplateColumns).toBe('subgrid')
    expect(row.style.gridColumn).toBe('1 / -1')
  })

  it('uses the same fixed icon slot size for type, suggested, and add-property rows', () => {
    render(
      <DynamicPropertiesPanel
        entry={entry}
        frontmatter={{}}
        onAddProperty={vi.fn()}
        onUpdateProperty={vi.fn()}
      />
    )

    expect(screen.getByTestId('type-row-icon-slot')).toHaveClass('size-5')
    screen.getAllByTestId('suggested-property-icon-slot').forEach((slot) => {
      expect(slot).toHaveClass('size-5')
    })
    expect(screen.getByTestId('add-property-icon-slot')).toHaveClass('size-5')
  })

  it('renders plain text values flush with the shared value column', () => {
    render(
      <DynamicPropertiesPanel
        entry={entry}
        frontmatter={{ Owner: 'Luca' }}
        onUpdateProperty={vi.fn()}
      />
    )

    expect(screen.getByText('Luca').parentElement).toHaveClass('px-0')
  })

  it('renders relationship groups as single-column stacks', () => {
    const relatedEntry: VaultEntry = {
      ...entry,
      path: '/vault/project-alpha.md',
      filename: 'project-alpha.md',
      title: 'Project Alpha',
      isA: 'Project',
    }

    render(
      <DynamicRelationshipsPanel
        frontmatter={{ 'Belongs to': '[[Project Alpha]]' }}
        entries={[relatedEntry]}
        typeEntryMap={{}}
        onNavigate={vi.fn()}
      />
    )

    const relationshipRow = screen.getByTestId('relationship-section-label').parentElement

    expect(relationshipRow).not.toBeNull()
    expect(relationshipRow).toHaveClass('flex-col')
    expect(relationshipRow).toHaveStyle({ gridColumn: '1 / -1' })
  })
})
