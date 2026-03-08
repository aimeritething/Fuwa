import { describe, it, expect } from 'vitest'
import { resolveTarget, collectLinkedEntries, buildContextualPrompt, buildContextSnapshot } from './ai-context'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
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
  outgoingLinks: [],
  ...overrides,
})

describe('resolveTarget', () => {
  const entries = [
    makeEntry({ path: '/vault/a.md', title: 'Alpha', filename: 'a.md' }),
    makeEntry({ path: '/vault/b.md', title: 'Beta', filename: 'beta-note.md', aliases: ['B'] }),
  ]

  it('resolves by title (case-insensitive)', () => {
    expect(resolveTarget('alpha', entries)?.path).toBe('/vault/a.md')
    expect(resolveTarget('Alpha', entries)?.path).toBe('/vault/a.md')
  })

  it('resolves by alias (case-insensitive)', () => {
    expect(resolveTarget('B', entries)?.path).toBe('/vault/b.md')
    expect(resolveTarget('b', entries)?.path).toBe('/vault/b.md')
  })

  it('resolves by filename stem', () => {
    expect(resolveTarget('beta-note', entries)?.path).toBe('/vault/b.md')
  })

  it('returns undefined for unresolvable target', () => {
    expect(resolveTarget('nonexistent', entries)).toBeUndefined()
  })
})

describe('collectLinkedEntries', () => {
  const entryA = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
  const entryB = makeEntry({ path: '/vault/b.md', title: 'Beta' })
  const entryC = makeEntry({ path: '/vault/c.md', title: 'Gamma' })
  const entryD = makeEntry({ path: '/vault/d.md', title: 'Delta' })
  const allEntries = [entryA, entryB, entryC, entryD]

  it('returns empty array when active has no links', () => {
    expect(collectLinkedEntries(entryA, allEntries)).toEqual([])
  })

  it('collects entries from outgoingLinks', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      outgoingLinks: ['Alpha', 'Beta'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha', 'Beta'])
  })

  it('collects entries from relationships', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      relationships: { relatedTo: ['[[Alpha]]', '[[Gamma]]'] },
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha', 'Gamma'])
  })

  it('collects entries from belongsTo', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      belongsTo: ['[[Delta]]'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Delta'])
  })

  it('collects entries from relatedTo', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      relatedTo: ['[[Beta]]'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Beta'])
  })

  it('deduplicates entries across all link sources', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      outgoingLinks: ['Alpha', 'Beta'],
      relationships: { people: ['[[Alpha]]'] },
      belongsTo: ['[[Beta]]'],
      relatedTo: ['[[Alpha]]'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha', 'Beta'])
  })

  it('excludes the active note itself', () => {
    const active = makeEntry({
      path: '/vault/a.md', title: 'Alpha',
      outgoingLinks: ['Alpha'],
    })
    const linked = collectLinkedEntries(active, allEntries)
    expect(linked).toEqual([])
  })

  it('ignores unresolvable links', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      outgoingLinks: ['Alpha', 'Nonexistent'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha'])
  })
})

describe('buildContextualPrompt', () => {
  it('includes active note title and content', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha', isA: 'Project' })
    const content = { '/vault/a.md': '# Alpha\nThis is the alpha project.' }
    const prompt = buildContextualPrompt(active, [], content)
    expect(prompt).toContain('Alpha')
    expect(prompt).toContain('Project')
    expect(prompt).toContain('This is the alpha project.')
  })

  it('includes linked note content', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const linked = makeEntry({ path: '/vault/b.md', title: 'Beta', isA: 'Person' })
    const content = {
      '/vault/a.md': '# Alpha\nMain note.',
      '/vault/b.md': '# Beta\nLinked person.',
    }
    const prompt = buildContextualPrompt(active, [linked], content)
    expect(prompt).toContain('Beta')
    expect(prompt).toContain('Person')
    expect(prompt).toContain('Linked person.')
    expect(prompt).toContain('Linked Notes')
  })

  it('shows (no content) when content is missing', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const prompt = buildContextualPrompt(active, [], {})
    expect(prompt).toContain('(no content)')
  })

  it('truncates linked note content to 2000 chars', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const linked = makeEntry({ path: '/vault/b.md', title: 'Beta' })
    const longContent = 'x'.repeat(3000)
    const content = {
      '/vault/a.md': '# Alpha',
      '/vault/b.md': longContent,
    }
    const prompt = buildContextualPrompt(active, [linked], content)
    // The linked note content should be truncated
    const betaIdx = prompt.indexOf('### Beta')
    const afterBeta = prompt.slice(betaIdx)
    expect(afterBeta.length).toBeLessThan(2200)
  })

  it('includes the system preamble', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const prompt = buildContextualPrompt(active, [], { '/vault/a.md': 'content' })
    expect(prompt).toContain('AI assistant integrated into Laputa')
  })
})

describe('buildContextSnapshot', () => {
  const active = makeEntry({ path: '/vault/a.md', title: 'Alpha', isA: 'Project', status: 'active', owner: 'Alice' })
  const entries = [
    active,
    makeEntry({ path: '/vault/b.md', title: 'Beta', isA: 'Person' }),
    makeEntry({ path: '/vault/c.md', title: 'Gamma', isA: 'Note' }),
  ]
  const allContent: Record<string, string> = {
    '/vault/a.md': '# Alpha\nProject content.',
    '/vault/b.md': '# Beta\nPerson content.',
    '/vault/c.md': '# Gamma\nNote content.',
  }

  it('includes activeNote with body and frontmatter', () => {
    const result = buildContextSnapshot({ activeEntry: active, allContent, entries })
    expect(result).toContain('Alpha')
    expect(result).toContain('Project content.')
    expect(result).toContain('"type": "Project"')
    expect(result).toContain('"status": "active"')
    expect(result).toContain('"owner": "Alice"')
  })

  it('includes system preamble', () => {
    const result = buildContextSnapshot({ activeEntry: active, allContent, entries })
    expect(result).toContain('AI assistant integrated into Laputa')
    expect(result).toContain('Context Snapshot')
  })

  it('includes vault summary with types and totalNotes', () => {
    const result = buildContextSnapshot({ activeEntry: active, allContent, entries })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.vault.totalNotes).toBe(3)
    expect(json.vault.types).toContain('Project')
    expect(json.vault.types).toContain('Person')
    expect(json.vault.types).toContain('Note')
  })

  it('includes openTabs excluding active note', () => {
    const tab = makeEntry({ path: '/vault/b.md', title: 'Beta', isA: 'Person' })
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      openTabs: [active, tab],
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.openTabs).toHaveLength(1)
    expect(json.openTabs[0].title).toBe('Beta')
  })

  it('omits openTabs when none besides active', () => {
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      openTabs: [active],
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.openTabs).toBeUndefined()
  })

  it('includes noteListFilter when present', () => {
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      noteListFilter: { type: 'Project', query: 'search' },
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.noteListFilter.type).toBe('Project')
    expect(json.noteListFilter.query).toBe('search')
  })

  it('omits noteListFilter when empty', () => {
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      noteListFilter: { type: null, query: '' },
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.noteListFilter).toBeUndefined()
  })

  it('includes referencedNotes with bodies', () => {
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      references: [
        { title: 'Beta', path: '/vault/b.md', type: 'Person' },
        { title: 'Gamma', path: '/vault/c.md', type: null },
      ],
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.referencedNotes).toHaveLength(2)
    expect(json.referencedNotes[0].title).toBe('Beta')
    expect(json.referencedNotes[0].body).toContain('Person content.')
    expect(json.referencedNotes[1].type).toBe('Note') // null fallback
  })

  it('filters out references with no content', () => {
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      references: [
        { title: 'Beta', path: '/vault/b.md', type: 'Person' },
        { title: 'Missing', path: '/vault/missing.md', type: null },
      ],
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.referencedNotes).toHaveLength(1)
    expect(json.referencedNotes[0].title).toBe('Beta')
  })

  it('omits referencedNotes when no references provided', () => {
    const result = buildContextSnapshot({ activeEntry: active, allContent, entries })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.referencedNotes).toBeUndefined()
  })

  it('includes noteList when provided', () => {
    const noteList = [
      { path: '/vault/a.md', title: 'Alpha', type: 'Project' },
      { path: '/vault/b.md', title: 'Beta', type: 'Person' },
    ]
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      noteList,
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.noteList).toHaveLength(2)
    expect(json.noteList[0].title).toBe('Alpha')
    expect(json.noteList[1].type).toBe('Person')
  })

  it('truncates noteList at 100 items', () => {
    const noteList = Array.from({ length: 150 }, (_, i) => ({
      path: `/vault/note-${i}.md`, title: `Note ${i}`, type: 'Note',
    }))
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      noteList,
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.noteList).toHaveLength(100)
    expect(json.noteListTruncated).toEqual({ shown: 100, total: 150 })
  })

  it('omits noteList when empty', () => {
    const result = buildContextSnapshot({
      activeEntry: active, allContent, entries,
      noteList: [],
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.noteList).toBeUndefined()
  })

  it('strips frontmatter from activeNoteContent before setting body', () => {
    const emptyAllContent: Record<string, string> = {}
    const result = buildContextSnapshot({
      activeEntry: active,
      allContent: emptyAllContent,
      entries,
      activeNoteContent: '---\ntitle: Alpha\n---\n\n# Alpha\nProject content from tab.',
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.body).toContain('Project content from tab.')
    expect(json.activeNote.body).not.toContain('---')
    expect(json.activeNote.body).not.toContain('title: Alpha')
  })

  it('returns empty body when raw content is frontmatter-only (bug case)', () => {
    const result = buildContextSnapshot({
      activeEntry: active,
      allContent: {},
      entries,
      activeNoteContent: '---\ntitle: Alpha\nis_a: Project\nstatus: active\n---\n',
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.body).toBe('')
  })

  it('prefers activeNoteContent body over allContent when both present', () => {
    const result = buildContextSnapshot({
      activeEntry: active,
      allContent,
      entries,
      activeNoteContent: '---\ntitle: Alpha\n---\nFresh editor content',
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.body).toBe('Fresh editor content')
  })

  it('falls back to allContent when activeNoteContent is undefined', () => {
    const result = buildContextSnapshot({ activeEntry: active, allContent, entries })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.body).toBe('# Alpha\nProject content.')
  })

  it('includes wordCount in activeNote', () => {
    const entryWithWords = makeEntry({ path: '/vault/a.md', title: 'Alpha', wordCount: 206 })
    const result = buildContextSnapshot({ activeEntry: entryWithWords, allContent, entries })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.wordCount).toBe(206)
  })

  it('handles content with no frontmatter (plain markdown)', () => {
    const result = buildContextSnapshot({
      activeEntry: active,
      allContent: {},
      entries,
      activeNoteContent: '# Just a heading\n\nSome plain content.',
    })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.body).toBe('# Just a heading\n\nSome plain content.')
  })

  it('includes wikilink instruction in preamble', () => {
    const result = buildContextSnapshot({ activeEntry: active, allContent, entries })
    expect(result).toContain('[[Note Title]]')
    expect(result).toContain('wikilink')
  })

  it('includes belongsTo and relatedTo in frontmatter', () => {
    const entryWithRels = makeEntry({
      path: '/vault/a.md', title: 'Alpha',
      belongsTo: ['[[Parent]]'],
      relatedTo: ['[[Sibling]]'],
      relationships: { people: ['[[Alice]]'] },
    })
    const result = buildContextSnapshot({ activeEntry: entryWithRels, allContent, entries })
    const json = JSON.parse(result.split('```json\n')[1].split('\n```')[0])
    expect(json.activeNote.frontmatter.belongsTo).toEqual(['[[Parent]]'])
    expect(json.activeNote.frontmatter.relatedTo).toEqual(['[[Sibling]]'])
    expect(json.activeNote.frontmatter.relationships).toEqual({ people: ['[[Alice]]'] })
  })
})
