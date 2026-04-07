import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NoteItem } from './NoteItem'
import type { VaultEntry } from '../types'

vi.mock('../mock-tauri', () => ({ isTauri: () => false, mockInvoke: vi.fn() }))

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/test.md', filename: 'test.md', title: 'Test Note',
    isA: 'Movie', aliases: [], belongsTo: [], relatedTo: [],
    status: null, archived: false,
    modifiedAt: 1700000000, createdAt: null, fileSize: 100,
    snippet: 'A snippet', wordCount: 50,
    relationships: {}, icon: null, color: null, order: null,
    sidebarLabel: null, template: null, sort: null, view: null,
    visible: null, favorite: false, favoriteIndex: null,
    outgoingLinks: [], properties: {},
    listPropertiesDisplay: [],
    ...overrides,
  }
}

function makeTypeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return makeEntry({
    path: '/vault/movie.md', filename: 'movie.md', title: 'Movie',
    isA: 'Type', listPropertiesDisplay: [],
    ...overrides,
  })
}

const noop = vi.fn()

describe('NoteItem property chips', () => {
  it('renders property chips when type has listPropertiesDisplay', () => {
    const entry = makeEntry({
      properties: { rating: 4, genre: 'Drama' },
    })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: ['rating', 'genre'] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} onClickNote={noop} />
    )

    expect(screen.getByTestId('property-chips')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
  })

  it('does not render chips when listPropertiesDisplay is empty', () => {
    const entry = makeEntry({ properties: { rating: 4 } })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: [] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} onClickNote={noop} />
    )

    expect(screen.queryByTestId('property-chips')).not.toBeInTheDocument()
  })

  it('skips chips for missing properties', () => {
    const entry = makeEntry({ properties: { rating: 4 } })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: ['rating', 'genre'] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} onClickNote={noop} />
    )

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByText('genre')).not.toBeInTheDocument()
  })

  it('renders relationship values as display labels', () => {
    const entry = makeEntry({
      relationships: { Director: ['[[spielberg|Steven Spielberg]]'] },
    })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: ['Director'] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} onClickNote={noop} />
    )

    expect(screen.getByText('Steven Spielberg')).toBeInTheDocument()
  })

  it('shows the target note icon as a prefix on relationship chips', () => {
    const entry = makeEntry({
      relationships: { Director: ['[[spielberg|Steven Spielberg]]'] },
    })
    const director = makeEntry({
      path: '/vault/spielberg.md',
      filename: 'spielberg.md',
      title: 'Steven Spielberg',
      isA: 'Person',
      icon: 'star',
    })
    const movieType = makeTypeEntry({ listPropertiesDisplay: ['Director'] })
    const personType = makeTypeEntry({
      path: '/vault/person.md',
      filename: 'person.md',
      title: 'Person',
      icon: 'users',
    })

    render(
      <NoteItem
        entry={entry}
        isSelected={false}
        noteStatus="clean"
        typeEntryMap={{ Movie: movieType, Person: personType }}
        allEntries={[entry, director, movieType, personType]}
        onClickNote={noop}
      />
    )

    const chip = screen.getByText('Steven Spielberg').parentElement
    expect(chip?.querySelector('svg')).toBeInTheDocument()
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('falls back to the target type icon when the target note has no icon', () => {
    const entry = makeEntry({
      relationships: { Director: ['[[spielberg|Steven Spielberg]]'] },
    })
    const director = makeEntry({
      path: '/vault/spielberg.md',
      filename: 'spielberg.md',
      title: 'Steven Spielberg',
      isA: 'Person',
      icon: null,
    })
    const movieType = makeTypeEntry({ listPropertiesDisplay: ['Director'] })
    const personType = makeTypeEntry({
      path: '/vault/person.md',
      filename: 'person.md',
      title: 'Person',
      icon: 'users',
    })

    render(
      <NoteItem
        entry={entry}
        isSelected={false}
        noteStatus="clean"
        typeEntryMap={{ Movie: movieType, Person: personType }}
        allEntries={[entry, director, movieType, personType]}
        onClickNote={noop}
      />
    )

    const chip = screen.getByText('Steven Spielberg').parentElement
    expect(chip?.querySelector('svg')).toBeInTheDocument()
  })

  it('renders relationship chips without a prefix when neither note nor type has an icon', () => {
    const entry = makeEntry({
      relationships: { Director: ['[[spielberg|Steven Spielberg]]'] },
    })
    const director = makeEntry({
      path: '/vault/spielberg.md',
      filename: 'spielberg.md',
      title: 'Steven Spielberg',
      isA: 'Person',
      icon: null,
    })
    const movieType = makeTypeEntry({ listPropertiesDisplay: ['Director'] })
    const personType = makeTypeEntry({
      path: '/vault/person.md',
      filename: 'person.md',
      title: 'Person',
      icon: null,
    })

    render(
      <NoteItem
        entry={entry}
        isSelected={false}
        noteStatus="clean"
        typeEntryMap={{ Movie: movieType, Person: personType }}
        allEntries={[entry, director, movieType, personType]}
        onClickNote={noop}
      />
    )

    const chip = screen.getByText('Steven Spielberg').parentElement
    expect(chip?.querySelector('svg')).toBeNull()
    expect(chip?.querySelector('img')).toBeNull()
  })

  it('falls back to the target type icon when the target note image icon fails to load', () => {
    const entry = makeEntry({
      relationships: { Director: ['[[spielberg|Steven Spielberg]]'] },
    })
    const director = makeEntry({
      path: '/vault/spielberg.md',
      filename: 'spielberg.md',
      title: 'Steven Spielberg',
      isA: 'Person',
      icon: 'https://example.com/director.png',
    })
    const movieType = makeTypeEntry({ listPropertiesDisplay: ['Director'] })
    const personType = makeTypeEntry({
      path: '/vault/person.md',
      filename: 'person.md',
      title: 'Person',
      icon: 'users',
    })

    render(
      <NoteItem
        entry={entry}
        isSelected={false}
        noteStatus="clean"
        typeEntryMap={{ Movie: movieType, Person: personType }}
        allEntries={[entry, director, movieType, personType]}
        onClickNote={noop}
      />
    )

    const chip = screen.getByText('Steven Spielberg').parentElement
    const image = chip?.querySelector('img')
    expect(image).toBeInTheDocument()
    fireEvent.error(image!)
    expect(chip?.querySelector('img')).toBeNull()
    expect(chip?.querySelector('svg')).toBeInTheDocument()
  })

  it('shows hostname for URL properties', () => {
    const entry = makeEntry({
      properties: { url: 'https://www.example.com/page/123' },
    })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: ['url'] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} onClickNote={noop} />
    )

    expect(screen.getByText('www.example.com')).toBeInTheDocument()
  })

  it('prefers displayPropsOverride over the type defaults', () => {
    const entry = makeEntry({
      properties: { rating: 4, Owner: 'Luca' },
    })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: ['rating'] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} displayPropsOverride={['Owner']} onClickNote={noop} />
    )

    expect(screen.getByText('Luca')).toBeInTheDocument()
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })

  it('does not render chips for binary files', () => {
    const entry = makeEntry({
      fileKind: 'binary',
      properties: { rating: 4 },
    })
    const typeEntry = makeTypeEntry({ listPropertiesDisplay: ['rating'] })

    render(
      <NoteItem entry={entry} isSelected={false} noteStatus="clean"
        typeEntryMap={{ Movie: typeEntry }} onClickNote={noop} />
    )

    expect(screen.queryByTestId('property-chips')).not.toBeInTheDocument()
  })
})

describe('NoteItem note icons', () => {
  it('renders a Phosphor note icon in the note row', () => {
    render(
      <NoteItem
        entry={makeEntry({ icon: 'star' })}
        isSelected={false}
        noteStatus="clean"
        typeEntryMap={{ Movie: makeTypeEntry() }}
        onClickNote={noop}
      />
    )

    expect(screen.getByTestId('note-title-icon').tagName.toLowerCase()).toBe('svg')
  })

  it('renders an image note icon in the note row', () => {
    render(
      <NoteItem
        entry={makeEntry({ icon: 'https://example.com/favicon.png' })}
        isSelected={false}
        noteStatus="clean"
        typeEntryMap={{ Movie: makeTypeEntry() }}
        onClickNote={noop}
      />
    )

    const icon = screen.getByTestId('note-title-icon')
    expect(icon.tagName.toLowerCase()).toBe('img')
    expect(icon).toHaveAttribute('src', 'https://example.com/favicon.png')
  })
})
