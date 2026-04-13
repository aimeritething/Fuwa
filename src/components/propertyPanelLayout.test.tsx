import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
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
})
