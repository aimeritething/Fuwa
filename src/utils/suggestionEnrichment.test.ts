import { describe, it, expect, vi } from 'vitest'
import { attachClickHandlers, enrichSuggestionItems } from './suggestionEnrichment'
import type { VaultEntry } from '../types'

vi.mock('@blocknote/core/extensions', () => ({
  filterSuggestionItems: <T extends { title: string; aliases: string[] }>(items: T[], query: string) =>
    items.filter(i => i.title.toLowerCase().includes(query.toLowerCase()) || i.aliases.some(a => a.toLowerCase().includes(query.toLowerCase()))),
}))

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/test.md', filename: 'test.md', title: 'Test', isA: null,
    aliases: [], belongsTo: [], relatedTo: [], status: null,
    archived: false, modifiedAt: null, createdAt: null,
    fileSize: 0, snippet: '', wordCount: 0, relationships: {}, icon: null, color: null,
    order: null, template: null, sort: null, outgoingLinks: [],
    ...overrides,
  }
}

describe('attachClickHandlers', () => {
  const vaultPath = '/vault'

  it('inserts relative path stem as wikilink target', () => {
    const insertWikilink = vi.fn()
    const candidates = [
      { title: 'Note A', aliases: [], group: 'Note', entryTitle: 'Note A', path: '/vault/a.md' },
      { title: 'Note B', aliases: [], group: 'Project', entryTitle: 'Note B', path: '/vault/b.md' },
    ]

    const result = attachClickHandlers(candidates, insertWikilink, vaultPath)

    expect(result).toHaveLength(2)
    result[0].onItemClick()
    expect(insertWikilink).toHaveBeenCalledWith('a')
    result[1].onItemClick()
    expect(insertWikilink).toHaveBeenCalledWith('b')
  })

  it('preserves all original properties', () => {
    const result = attachClickHandlers(
      [{ title: 'X', aliases: ['y'], group: 'Topic', entryTitle: 'X', path: '/vault/x.md' }],
      vi.fn(),
      vaultPath,
    )
    expect(result[0]).toMatchObject({ title: 'X', aliases: ['y'], group: 'Topic', path: '/vault/x.md' })
  })

  it('includes subfolder path in wikilink target', () => {
    const insertWikilink = vi.fn()
    const candidates = [
      { title: 'ADR 001', aliases: [], group: 'Note', entryTitle: 'ADR 001', path: '/vault/docs/adr/0001-tauri-stack.md' },
    ]

    const result = attachClickHandlers(candidates, insertWikilink, vaultPath)

    result[0].onItemClick()
    expect(insertWikilink).toHaveBeenCalledWith('docs/adr/0001-tauri-stack')
  })

  it('omits any default alias even when the title differs from the path stem', () => {
    const insertWikilink = vi.fn()
    const candidates = [
      { title: 'Roadmap', aliases: [], group: 'Note', entryTitle: 'Roadmap', path: '/vault/roadmap.md' },
    ]

    const result = attachClickHandlers(candidates, insertWikilink, vaultPath)

    result[0].onItemClick()
    expect(insertWikilink).toHaveBeenCalledWith('roadmap')
  })
})

describe('enrichSuggestionItems', () => {
  const typeEntryMap: Record<string, VaultEntry> = {
    Project: makeEntry({ isA: 'Type', title: 'Project', color: 'blue', icon: 'wrench' }),
  }

  function makeItem(title: string, group: string, path: string) {
    return { title, aliases: [] as string[], group, entryTitle: title, path, onItemClick: vi.fn() }
  }

  it('filters items by query', () => {
    const items = [makeItem('Alpha', 'Note', '/a.md'), makeItem('Beta', 'Note', '/b.md')]
    const result = enrichSuggestionItems(items, 'alp', {})
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Alpha')
  })

  it('adds type metadata for non-Note groups', () => {
    const items = [makeItem('My Project', 'Project', '/p.md')]
    const result = enrichSuggestionItems(items, '', typeEntryMap)
    expect(result[0].noteType).toBe('Project')
    expect(result[0].typeColor).toBeDefined()
    expect(result[0].typeLightColor).toBeDefined()
    expect(result[0].TypeIcon).toBeDefined()
  })

  it('omits type metadata for Note group', () => {
    const items = [makeItem('Plain Note', 'Note', '/n.md')]
    const result = enrichSuggestionItems(items, '', {})
    expect(result[0].noteType).toBeUndefined()
    expect(result[0].typeColor).toBeUndefined()
  })

  it('deduplicates items with the same path', () => {
    const items = [
      makeItem('Note', 'Note', '/n.md'),
      makeItem('Note Alias', 'Note', '/n.md'),
    ]
    const result = enrichSuggestionItems(items, '', {})
    expect(result).toHaveLength(1)
  })

  it('limits results to 20', () => {
    const items = Array.from({ length: 30 }, (_, i) => makeItem(`Note ${i}`, 'Note', `/n${i}.md`))
    const result = enrichSuggestionItems(items, '', {})
    expect(result.length).toBeLessThanOrEqual(20)
  })

  it('ranks exact title match first among prefix competitors', () => {
    const items = [
      makeItem('Refactoring Ideas', 'Note', '/ri.md'),
      makeItem('Refactoring Key Ideas', 'Note', '/rk.md'),
      makeItem('Refactoring', 'Area', '/r.md'),
    ]
    const result = enrichSuggestionItems(items, 'Refactoring', {})
    expect(result[0].title).toBe('Refactoring')
  })
})
