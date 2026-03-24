import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import {
  slugify,
  buildNewEntry,
  generateUntitledName,
  entryMatchesTarget,
  buildNoteContent,
  resolveNewNote,
  resolveNewType,
  resolveTemplate,
  DEFAULT_TEMPLATES,
  todayDateString,
  buildDailyNoteContent,
  resolveDailyNote,
  findDailyNote,
  useNoteCreation,
} from './useNoteCreation'
import type { NoteCreationConfig } from './useNoteCreation'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  trackMockChange: vi.fn(),
  mockInvoke: vi.fn().mockResolvedValue(''),
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/test.md', filename: 'test.md', title: 'Test Note', isA: 'Note',
  aliases: [], belongsTo: [], relatedTo: [], status: 'Active', archived: false, trashed: false, trashedAt: null,
  modifiedAt: 1700000000, createdAt: 1700000000, fileSize: 100, snippet: '',
  wordCount: 0, relationships: {}, icon: null, color: null, order: null,
  outgoingLinks: [], template: null, sort: null, sidebarLabel: null,
  view: null, visible: null, properties: {},
  ...overrides,
})

describe('slugify', () => {
  it('converts text to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('My Project! @#$%')).toBe('my-project')
  })

  it('handles empty string with fallback', () => {
    expect(slugify('')).toBe('untitled')
  })

  it('returns fallback for strings with only special characters', () => {
    expect(slugify('+++')).not.toBe('')
    expect(slugify('---')).not.toBe('')
  })
})

describe('buildNewEntry', () => {
  it('creates a VaultEntry with correct fields', () => {
    const entry = buildNewEntry({ path: '/vault/my-note.md', slug: 'my-note', title: 'My Note', type: 'Note', status: 'Active' })
    expect(entry.path).toBe('/vault/my-note.md')
    expect(entry.filename).toBe('my-note.md')
    expect(entry.title).toBe('My Note')
    expect(entry.isA).toBe('Note')
    expect(entry.status).toBe('Active')
    expect(entry.archived).toBe(false)
    expect(entry.trashed).toBe(false)
  })

  it('sets null status when provided', () => {
    const entry = buildNewEntry({ path: '/vault/ai.md', slug: 'ai', title: 'AI', type: 'Topic', status: null })
    expect(entry.status).toBeNull()
  })
})

describe('generateUntitledName', () => {
  it('returns base name when no conflicts', () => {
    expect(generateUntitledName([], 'Note')).toBe('Untitled note')
  })

  it('appends counter when base name exists', () => {
    expect(generateUntitledName([makeEntry({ title: 'Untitled note' })], 'Note')).toBe('Untitled note 2')
  })

  it('increments counter past existing numbered entries', () => {
    const entries = [
      makeEntry({ title: 'Untitled note' }),
      makeEntry({ title: 'Untitled note 2' }),
      makeEntry({ title: 'Untitled note 3' }),
    ]
    expect(generateUntitledName(entries, 'Note')).toBe('Untitled note 4')
  })

  it('avoids names in the pending set', () => {
    expect(generateUntitledName([], 'Note', new Set(['Untitled note']))).toBe('Untitled note 2')
  })
})

describe('entryMatchesTarget', () => {
  it('matches by exact title (case-insensitive)', () => {
    expect(entryMatchesTarget(makeEntry({ title: 'My Project' }), 'my project')).toBe(true)
  })

  it('matches by alias', () => {
    expect(entryMatchesTarget(makeEntry({ aliases: ['MP'] }), 'mp')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(entryMatchesTarget(makeEntry({ title: 'Something' }), 'nonexistent')).toBe(false)
  })
})

describe('buildNoteContent', () => {
  it('generates frontmatter with status', () => {
    expect(buildNoteContent('My Note', 'Note', 'Active')).toBe('---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n\n# My Note\n\n')
  })

  it('omits status when null', () => {
    expect(buildNoteContent('AI', 'Topic', null)).toBe('---\ntitle: AI\ntype: Topic\n---\n\n# AI\n\n')
  })

  it('includes template body when provided', () => {
    const content = buildNoteContent('P', 'Project', 'Active', '## Objective\n\n')
    expect(content).toContain('## Objective')
  })
})

describe('resolveNewNote', () => {
  it('creates note at vault root', () => {
    const { entry, content } = resolveNewNote('My Project', 'Project', '/vault')
    expect(entry.path).toBe('/vault/my-project.md')
    expect(entry.isA).toBe('Project')
    expect(entry.status).toBe('Active')
    expect(content).toContain('type: Project')
  })

  it('omits status for Topic type', () => {
    const { entry } = resolveNewNote('ML', 'Topic', '/vault')
    expect(entry.status).toBeNull()
  })
})

describe('resolveNewType', () => {
  it('creates a type entry', () => {
    const { entry, content } = resolveNewType('Recipe', '/vault')
    expect(entry.path).toBe('/vault/recipe.md')
    expect(entry.isA).toBe('Type')
    expect(content).toContain('type: Type')
  })
})

describe('resolveTemplate', () => {
  it('returns template from type entry when set', () => {
    const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', template: '## Ingredients\n\n' })
    expect(resolveTemplate([typeEntry], 'Recipe')).toBe('## Ingredients\n\n')
  })

  it('falls back to DEFAULT_TEMPLATES', () => {
    expect(resolveTemplate([], 'Project')).toBe(DEFAULT_TEMPLATES.Project)
  })

  it('returns null when no template and no default', () => {
    expect(resolveTemplate([], 'CustomType')).toBeNull()
  })
})

describe('todayDateString', () => {
  it('returns date in YYYY-MM-DD format', () => {
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('buildDailyNoteContent', () => {
  it('generates frontmatter with Journal type and date', () => {
    const content = buildDailyNoteContent('2026-03-02')
    expect(content).toContain('type: Journal')
    expect(content).toContain('date: 2026-03-02')
    expect(content).toContain('## Intentions')
  })
})

describe('resolveDailyNote', () => {
  it('creates entry with date as filename', () => {
    const { entry } = resolveDailyNote('2026-03-02', '/vault')
    expect(entry.path).toBe('/vault/2026-03-02.md')
    expect(entry.isA).toBe('Journal')
  })
})

describe('findDailyNote', () => {
  it('finds entry by filename and Journal type', () => {
    const entries = [makeEntry({ filename: '2026-03-02.md', isA: 'Journal' })]
    expect(findDailyNote(entries, '2026-03-02')).toBeDefined()
  })

  it('returns undefined when no match', () => {
    expect(findDailyNote([], '2026-03-02')).toBeUndefined()
  })

  it('does not match non-Journal notes', () => {
    const entries = [makeEntry({ filename: '2026-03-02.md', isA: 'Note' })]
    expect(findDailyNote(entries, '2026-03-02')).toBeUndefined()
  })
})

describe('useNoteCreation hook', () => {
  const addEntry = vi.fn()
  const removeEntry = vi.fn()
  const setToastMessage = vi.fn()
  const openTabWithContent = vi.fn()
  const handleSelectNote = vi.fn()
  const makeConfig = (entries: VaultEntry[] = []): NoteCreationConfig => ({
    addEntry, removeEntry, entries, setToastMessage, vaultPath: '/test/vault',
  })

  const tabDeps = { openTabWithContent, handleSelectNote }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
  })

  it('handleCreateNote creates entry and opens tab', () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    act(() => { result.current.handleCreateNote('Test Note', 'Note') })
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(openTabWithContent).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.title).toBe('Test Note')
    expect(createdEntry.isA).toBe('Note')
  })

  it('handleCreateNoteImmediate generates untitled name', () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    act(() => { result.current.handleCreateNoteImmediate() })
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry.mock.calls[0][0].title).toBe('Untitled note')
  })

  it('handleCreateNoteImmediate generates unique names on rapid calls', () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    act(() => {
      result.current.handleCreateNoteImmediate()
      result.current.handleCreateNoteImmediate()
      result.current.handleCreateNoteImmediate()
    })
    const titles = addEntry.mock.calls.map(([e]: [VaultEntry]) => e.title)
    expect(titles).toEqual(['Untitled note', 'Untitled note 2', 'Untitled note 3'])
  })

  it('handleCreateNoteImmediate accepts custom type', () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    act(() => { result.current.handleCreateNoteImmediate('Project') })
    expect(addEntry.mock.calls[0][0].isA).toBe('Project')
  })

  it('handleCreateNoteImmediate tracks unsaved state', async () => {
    const trackUnsaved = vi.fn()
    const markContentPending = vi.fn()
    const config = makeConfig()
    config.trackUnsaved = trackUnsaved
    config.markContentPending = markContentPending
    const { result } = renderHook(() => useNoteCreation(config, tabDeps))
    await act(async () => { result.current.handleCreateNoteImmediate() })
    expect(trackUnsaved).toHaveBeenCalledWith(expect.stringContaining('untitled-note.md'))
    expect(markContentPending).toHaveBeenCalled()
  })

  it('handleOpenDailyNote creates new daily note when none exists', () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    act(() => { result.current.handleOpenDailyNote() })
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry.mock.calls[0][0].isA).toBe('Journal')
  })

  it('handleOpenDailyNote opens existing daily note', () => {
    const today = todayDateString()
    const existing = makeEntry({ filename: `${today}.md`, isA: 'Journal' })
    const { result } = renderHook(() => useNoteCreation(makeConfig([existing]), tabDeps))
    act(() => { result.current.handleOpenDailyNote() })
    expect(addEntry).not.toHaveBeenCalled()
    expect(handleSelectNote).toHaveBeenCalledWith(existing)
  })

  it('handleCreateType creates type entry', () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    act(() => { result.current.handleCreateType('Recipe') })
    expect(addEntry.mock.calls[0][0].isA).toBe('Type')
    expect(addEntry.mock.calls[0][0].title).toBe('Recipe')
  })

  it('createTypeEntrySilent persists without opening tab', async () => {
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    const entry = await act(async () => result.current.createTypeEntrySilent('Recipe'))
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(openTabWithContent).not.toHaveBeenCalled()
    expect(entry.isA).toBe('Type')
  })

  it('reverts optimistic creation when disk write fails (Tauri)', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))
    const { result } = renderHook(() => useNoteCreation(makeConfig(), tabDeps))
    await act(async () => {
      result.current.handleCreateNote('Failing Note', 'Note')
      await new Promise(r => setTimeout(r, 0))
    })
    expect(removeEntry).toHaveBeenCalled()
    expect(setToastMessage).toHaveBeenCalledWith('Failed to create note — disk write error')
  })

})
