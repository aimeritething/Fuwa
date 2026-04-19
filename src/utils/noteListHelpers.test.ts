import { describe, expect, it } from 'vitest'
import { buildRelationshipGroups, countAllByFilter, countAllNotesByFilter, countByFilter, filterEntries } from './noteListHelpers'
import { allSelection, makeEntry, mockEntries } from '../test-utils/noteListTestUtils'

describe('filterEntries', () => {
  it('returns empty for entity selections because entity view uses grouped relationships', () => {
    const result = filterEntries(mockEntries, { kind: 'entity', entry: mockEntries[4] })
    expect(result).toHaveLength(0)
  })

  it('filters section groups by open sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'open')
    expect(result.map((entry) => entry.title)).toEqual(['Active'])
  })

  it('filters section groups by archived sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'archived')
    expect(result.map((entry) => entry.title)).toEqual(['Archived'])
  })

  it('defaults section groups to active notes when no sub-filter is provided', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' })
    expect(result.map((entry) => entry.title)).toEqual(['Active'])
  })

  it('filters all notes by open sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, allSelection, 'open')
    expect(result.map((entry) => entry.title)).toEqual(['Active', 'Other'])
  })

  it('filters all notes by archived sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, allSelection, 'archived')
    expect(result.map((entry) => entry.title)).toEqual(['Archived'])
  })

  it('excludes attachments-folder markdown from the All Notes view', () => {
    const entries = [
      makeEntry({ path: '/vault/note/real-note.md', title: 'Real Note', isA: 'Note' }),
      makeEntry({ path: '/vault/attachments/reference.md', title: 'Attachment Markdown', isA: 'Note' }),
      makeEntry({ path: '/vault/attachments/nested/diagram.md', title: 'Nested Attachment Markdown', isA: 'Note' }),
    ]

    const result = filterEntries(entries, allSelection, 'open')
    expect(result.map((entry) => entry.title)).toEqual(['Real Note'])
  })
})

describe('countByFilter', () => {
  it('counts open and archived entries for a type', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project' }),
      makeEntry({ path: '/2.md', isA: 'Project', archived: true }),
      makeEntry({ path: '/3.md', isA: 'Project' }),
      makeEntry({ path: '/4.md', isA: 'Note' }),
    ]

    expect(countByFilter(entries, 'Project')).toEqual({ open: 2, archived: 1 })
  })

  it('returns zeros when a type has no matching entries', () => {
    expect(countByFilter([], 'Project')).toEqual({ open: 0, archived: 0 })
  })
})

describe('countAllByFilter', () => {
  it('counts all entries by archive status', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project' }),
      makeEntry({ path: '/2.md', isA: 'Note' }),
      makeEntry({ path: '/3.md', isA: 'Project', archived: true }),
    ]

    expect(countAllByFilter(entries)).toEqual({ open: 2, archived: 1 })
  })

  it('excludes non-markdown files from counts', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Note', fileKind: 'markdown' }),
      makeEntry({ path: '/2.yml', isA: undefined, fileKind: 'text' }),
      makeEntry({ path: '/3.png', isA: undefined, fileKind: 'binary' }),
    ]

    expect(countAllByFilter(entries)).toEqual({ open: 1, archived: 0 })
  })
})

describe('countAllNotesByFilter', () => {
  it('excludes attachments-folder files from All Notes totals', () => {
    const entries = [
      makeEntry({ path: '/vault/note/real-note.md', isA: 'Note' }),
      makeEntry({ path: '/vault/attachments/reference.md', isA: 'Note' }),
      makeEntry({ path: '/vault/attachments/archive.md', isA: 'Note', archived: true }),
      makeEntry({ path: '/vault/attachments/image.png', fileKind: 'binary' }),
      makeEntry({ path: '/vault/archive/real-archive.md', isA: 'Note', archived: true }),
    ]

    expect(countAllNotesByFilter(entries)).toEqual({ open: 1, archived: 1 })
  })
})

describe('buildRelationshipGroups', () => {
  it('keeps computed neighborhood groups visible when they are empty', () => {
    const standalone = makeEntry({
      path: '/vault/solo.md',
      filename: 'solo.md',
      title: 'Standalone',
      isA: 'Note',
    })

    const groups = buildRelationshipGroups(standalone, [standalone])

    expect(groups).toEqual([
      { label: 'Children', entries: [] },
      { label: 'Events', entries: [] },
      { label: 'Referenced By', entries: [] },
      { label: 'Backlinks', entries: [] },
    ])
  })

  it('allows the same note to appear in multiple relationship groups', () => {
    const parent = makeEntry({
      path: '/vault/parent.md',
      filename: 'parent.md',
      title: 'Parent',
      isA: 'Project',
      relationships: { 'Related to': ['[[shared-note]]'] },
    })
    const shared = makeEntry({
      path: '/vault/shared-note.md',
      filename: 'shared-note.md',
      title: 'Shared Note',
      isA: 'Note',
      relatedTo: ['[[parent]]'],
    })

    const groups = buildRelationshipGroups(parent, [parent, shared])

    expect(groups.find((group) => group.label === 'Related to')?.entries).toEqual([shared])
    expect(groups.find((group) => group.label === 'Referenced By')?.entries).toEqual([shared])
  })
})
