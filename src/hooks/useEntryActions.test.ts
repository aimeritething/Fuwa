import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry } from '../types'
import { useEntryActions } from './useEntryActions'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
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
  order: null, sidebarLabel: null,
  template: null, sort: null, view: null, visible: null,
  outgoingLinks: [],
  properties: {},
  ...overrides,
})

describe('useEntryActions', () => {
  const updateEntry = vi.fn()
  const handleUpdateFrontmatter = vi.fn().mockResolvedValue(undefined)
  const handleDeleteProperty = vi.fn().mockResolvedValue(undefined)
  const setToastMessage = vi.fn()
  const createTypeEntry = vi.fn().mockImplementation((typeName: string) =>
    Promise.resolve(makeEntry({ isA: 'Type', title: typeName, path: `/vault/${typeName.toLowerCase()}.md` })),
  )

  function setup(entries: VaultEntry[] = []) {
    return renderHook(() =>
      useEntryActions({
        entries,
        updateEntry,
        handleUpdateFrontmatter,
        handleDeleteProperty,
        setToastMessage,
        createTypeEntry,
        onFrontmatterPersisted,
      })
    )
  }

  const onFrontmatterPersisted = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleTrashNote', () => {
    it('sets trashed frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleTrashNote('/vault/note/test.md')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'Trashed', true, { silent: true })
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'Trashed at', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), { silent: true })
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', {
        trashed: true,
        trashedAt: expect.any(Number),
      })
      expect(setToastMessage).toHaveBeenCalledWith('Note moved to trash')
      expect(onFrontmatterPersisted).toHaveBeenCalledTimes(1)
    })

    it('final toast is contextual, not "Property updated"', async () => {
      const { result } = setup()
      const toastCalls: (string | null)[] = []
      setToastMessage.mockImplementation((msg: string | null) => toastCalls.push(msg))

      await act(async () => {
        await result.current.handleTrashNote('/vault/note/test.md')
      })

      // The only toast should be "Note moved to trash", never "Property updated"
      expect(toastCalls).toEqual(['Note moved to trash'])
    })
  })

  describe('handleRestoreNote', () => {
    it('clears trashed frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleRestoreNote('/vault/note/test.md')
      })

      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/note/test.md', 'Trashed', { silent: true })
      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/note/test.md', 'Trashed at', { silent: true })
      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', {
        trashed: false,
        trashedAt: null,
      })
      expect(setToastMessage).toHaveBeenCalledWith('Note restored from trash')
      expect(onFrontmatterPersisted).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleArchiveNote', () => {
    it('sets archived frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleArchiveNote('/vault/note/test.md')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'archived', true, { silent: true })
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', { archived: true })
      expect(setToastMessage).toHaveBeenCalledWith('Note archived')
      expect(onFrontmatterPersisted).toHaveBeenCalledTimes(1)
    })

    it('final toast is contextual, not "Property updated"', async () => {
      const { result } = setup()
      const toastCalls: (string | null)[] = []
      setToastMessage.mockImplementation((msg: string | null) => toastCalls.push(msg))

      await act(async () => {
        await result.current.handleArchiveNote('/vault/note/test.md')
      })

      expect(toastCalls).toEqual(['Note archived'])
    })
  })

  describe('handleUnarchiveNote', () => {
    it('clears archived frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleUnarchiveNote('/vault/note/test.md')
      })

      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/note/test.md', 'archived', { silent: true })
      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', { archived: false })
      expect(setToastMessage).toHaveBeenCalledWith('Note unarchived')
      expect(onFrontmatterPersisted).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleCustomizeType', () => {
    it('updates icon and color on the type entry', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleCustomizeType('Recipe', 'cooking-pot', 'green')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/recipe.md', 'icon', 'cooking-pot')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/recipe.md', 'color', 'green')
      expect(updateEntry).toHaveBeenCalledWith('/vault/recipe.md', { icon: 'cooking-pot', color: 'green' })
      expect(onFrontmatterPersisted).toHaveBeenCalled()
    })

    it('auto-creates type entry when not found and applies customization', async () => {
      const { result } = setup([])

      await act(async () => {
        await result.current.handleCustomizeType('Recipe', 'star', 'red')
      })

      expect(createTypeEntry).toHaveBeenCalledWith('Recipe')
      expect(updateEntry).toHaveBeenCalledWith('/vault/recipe.md', { icon: 'star', color: 'red' })
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/recipe.md', 'icon', 'star')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/recipe.md', 'color', 'red')
    })

    it('serializes frontmatter writes (icon before color)', async () => {
      const callOrder: string[] = []
      handleUpdateFrontmatter.mockImplementation((_path: string, key: string) => {
        callOrder.push(key)
        return Promise.resolve()
      })
      const typeEntry = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/project.md' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleCustomizeType('Project', 'wrench', 'blue')
      })

      expect(callOrder).toEqual(['icon', 'color'])
    })
  })

  describe('handleUpdateTypeTemplate', () => {
    it('updates template on the type entry', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/project.md' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleUpdateTypeTemplate('Project', '## Objective\n\n## Notes')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/project.md', 'template', '## Objective\n\n## Notes')
      expect(updateEntry).toHaveBeenCalledWith('/vault/project.md', { template: '## Objective\n\n## Notes' })
      expect(onFrontmatterPersisted).toHaveBeenCalled()
    })

    it('sets template to null when empty string', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/project.md' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleUpdateTypeTemplate('Project', '')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/project.md', 'template', '')
      expect(updateEntry).toHaveBeenCalledWith('/vault/project.md', { template: null })
    })

    it('auto-creates type entry when not found', async () => {
      const { result } = setup([])

      await act(async () => {
        await result.current.handleUpdateTypeTemplate('NonExistent', '## Template')
      })

      expect(createTypeEntry).toHaveBeenCalledWith('NonExistent')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/nonexistent.md', 'template', '## Template')
      expect(updateEntry).toHaveBeenCalledWith('/vault/nonexistent.md', { template: '## Template' })
    })
  })

  describe('handleReorderSections', () => {
    it('updates order on multiple type entries', async () => {
      const typeA = makeEntry({ isA: 'Type', title: 'Note', path: '/vault/note.md' })
      const typeB = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/project.md' })
      const { result } = setup([typeA, typeB])

      await act(async () => {
        await result.current.handleReorderSections([
          { typeName: 'Note', order: 0 },
          { typeName: 'Project', order: 1 },
        ])
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note.md', 'order', 0)
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/project.md', 'order', 1)
      expect(updateEntry).toHaveBeenCalledWith('/vault/note.md', { order: 0 })
      expect(updateEntry).toHaveBeenCalledWith('/vault/project.md', { order: 1 })
      expect(onFrontmatterPersisted).toHaveBeenCalled()
    })

    it('auto-creates type entries when not found', async () => {
      const typeA = makeEntry({ isA: 'Type', title: 'Note', path: '/vault/note.md' })
      const { result } = setup([typeA])

      await act(async () => {
        await result.current.handleReorderSections([
          { typeName: 'Note', order: 0 },
          { typeName: 'Missing', order: 1 },
        ])
      })

      expect(createTypeEntry).toHaveBeenCalledWith('Missing')
      expect(handleUpdateFrontmatter).toHaveBeenCalledTimes(2)
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note.md', 'order', 0)
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/missing.md', 'order', 1)
    })
  })

  describe('handleRenameSection', () => {
    it('writes sidebar label frontmatter and updates entry in memory', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md', sidebarLabel: null })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleRenameSection('Recipe', 'Recipes')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/recipe.md', 'sidebar label', 'Recipes')
      expect(updateEntry).toHaveBeenCalledWith('/vault/recipe.md', { sidebarLabel: 'Recipes' })
      expect(onFrontmatterPersisted).toHaveBeenCalled()
    })

    it('trims whitespace before saving', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md', sidebarLabel: null })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleRenameSection('Recipe', '  Dishes  ')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/recipe.md', 'sidebar label', 'Dishes')
      expect(updateEntry).toHaveBeenCalledWith('/vault/recipe.md', { sidebarLabel: 'Dishes' })
    })

    it('deletes sidebar label when label is empty', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md', sidebarLabel: 'Dishes' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleRenameSection('Recipe', '')
      })

      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/recipe.md', 'sidebar label')
      expect(updateEntry).toHaveBeenCalledWith('/vault/recipe.md', { sidebarLabel: null })
      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
    })

    it('auto-creates type entry when not found', async () => {
      const { result } = setup([])

      await act(async () => {
        await result.current.handleRenameSection('NonExistent', 'Label')
      })

      expect(createTypeEntry).toHaveBeenCalledWith('NonExistent')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/nonexistent.md', 'sidebar label', 'Label')
      expect(updateEntry).toHaveBeenCalledWith('/vault/nonexistent.md', { sidebarLabel: 'Label' })
    })
  })

  describe('handleToggleTypeVisibility', () => {
    it('sets visible to false when currently visible (null/default)', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Journal', path: '/vault/journal.md', visible: null })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleToggleTypeVisibility('Journal')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/journal.md', 'visible', false)
      expect(updateEntry).toHaveBeenCalledWith('/vault/journal.md', { visible: false })
      expect(onFrontmatterPersisted).toHaveBeenCalled()
    })

    it('sets visible to true (deletes property) when currently hidden', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Journal', path: '/vault/journal.md', visible: false })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleToggleTypeVisibility('Journal')
      })

      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/journal.md', 'visible')
      expect(updateEntry).toHaveBeenCalledWith('/vault/journal.md', { visible: null })
      expect(onFrontmatterPersisted).toHaveBeenCalled()
    })

    it('auto-creates type entry when not found', async () => {
      const { result } = setup([])

      await act(async () => {
        await result.current.handleToggleTypeVisibility('Journal')
      })

      expect(createTypeEntry).toHaveBeenCalledWith('Journal')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/journal.md', 'visible', false)
      expect(updateEntry).toHaveBeenCalledWith('/vault/journal.md', { visible: false })
    })
  })

  describe('failed disk writes do not update React state', () => {
    it('handleCustomizeType does not update entry when frontmatter write fails', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md' })
      handleUpdateFrontmatter.mockRejectedValueOnce(new Error('disk full'))
      const { result } = setup([typeEntry])

      await expect(
        act(() => result.current.handleCustomizeType('Recipe', 'star', 'red'))
      ).rejects.toThrow('disk full')

      expect(updateEntry).not.toHaveBeenCalled()
    })

    it('handleRenameSection does not update entry when frontmatter write fails', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md' })
      handleUpdateFrontmatter.mockRejectedValueOnce(new Error('disk full'))
      const { result } = setup([typeEntry])

      await expect(
        act(() => result.current.handleRenameSection('Recipe', 'Dishes'))
      ).rejects.toThrow('disk full')

      expect(updateEntry).not.toHaveBeenCalled()
    })

    it('handleRenameSection does not update entry when delete property fails', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/recipe.md', sidebarLabel: 'Dishes' })
      handleDeleteProperty.mockRejectedValueOnce(new Error('disk full'))
      const { result } = setup([typeEntry])

      await expect(
        act(() => result.current.handleRenameSection('Recipe', ''))
      ).rejects.toThrow('disk full')

      expect(updateEntry).not.toHaveBeenCalled()
    })

    it('handleToggleTypeVisibility does not update entry when frontmatter write fails (hide)', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Journal', path: '/vault/journal.md', visible: null })
      handleUpdateFrontmatter.mockRejectedValueOnce(new Error('disk full'))
      const { result } = setup([typeEntry])

      await expect(
        act(() => result.current.handleToggleTypeVisibility('Journal'))
      ).rejects.toThrow('disk full')

      expect(updateEntry).not.toHaveBeenCalled()
    })

    it('handleToggleTypeVisibility does not update entry when delete property fails (show)', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Journal', path: '/vault/journal.md', visible: false })
      handleDeleteProperty.mockRejectedValueOnce(new Error('disk full'))
      const { result } = setup([typeEntry])

      await expect(
        act(() => result.current.handleToggleTypeVisibility('Journal'))
      ).rejects.toThrow('disk full')

      expect(updateEntry).not.toHaveBeenCalled()
    })
  })

  describe('optimistic rollback on disk write failure', () => {
    it('rolls back trashed state when frontmatter write fails', async () => {
      handleUpdateFrontmatter.mockRejectedValueOnce(new Error('disk full'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = setup()

      await act(async () => {
        await result.current.handleTrashNote('/vault/note/test.md')
      })

      // First call: optimistic update (trashed: true)
      // Second call: rollback (trashed: false)
      expect(updateEntry).toHaveBeenCalledTimes(2)
      expect(updateEntry).toHaveBeenNthCalledWith(1, '/vault/note/test.md', {
        trashed: true, trashedAt: expect.any(Number),
      })
      expect(updateEntry).toHaveBeenNthCalledWith(2, '/vault/note/test.md', {
        trashed: false, trashedAt: null,
      })
      expect(setToastMessage).toHaveBeenCalledWith('Failed to trash note — rolled back')
      errorSpy.mockRestore()
    })

    it('rolls back archived state when frontmatter write fails', async () => {
      handleUpdateFrontmatter.mockRejectedValueOnce(new Error('disk full'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = setup()

      await act(async () => {
        await result.current.handleArchiveNote('/vault/note/test.md')
      })

      expect(updateEntry).toHaveBeenCalledTimes(2)
      expect(updateEntry).toHaveBeenNthCalledWith(1, '/vault/note/test.md', { archived: true })
      expect(updateEntry).toHaveBeenNthCalledWith(2, '/vault/note/test.md', { archived: false })
      expect(setToastMessage).toHaveBeenCalledWith('Failed to archive note — rolled back')
      errorSpy.mockRestore()
    })

    it('rolls back restore state when frontmatter write fails', async () => {
      handleDeleteProperty.mockRejectedValueOnce(new Error('disk full'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = setup()

      await act(async () => {
        await result.current.handleRestoreNote('/vault/note/test.md')
      })

      expect(updateEntry).toHaveBeenCalledTimes(2)
      expect(updateEntry).toHaveBeenNthCalledWith(1, '/vault/note/test.md', { trashed: false, trashedAt: null })
      expect(updateEntry).toHaveBeenNthCalledWith(2, '/vault/note/test.md', {
        trashed: true, trashedAt: expect.any(Number),
      })
      expect(setToastMessage).toHaveBeenCalledWith('Failed to restore note — rolled back')
      errorSpy.mockRestore()
    })

    it('rolls back unarchive state when frontmatter write fails', async () => {
      handleDeleteProperty.mockRejectedValueOnce(new Error('disk full'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = setup()

      await act(async () => {
        await result.current.handleUnarchiveNote('/vault/note/test.md')
      })

      expect(updateEntry).toHaveBeenCalledTimes(2)
      expect(updateEntry).toHaveBeenNthCalledWith(1, '/vault/note/test.md', { archived: false })
      expect(updateEntry).toHaveBeenNthCalledWith(2, '/vault/note/test.md', { archived: true })
      expect(setToastMessage).toHaveBeenCalledWith('Failed to unarchive note — rolled back')
      errorSpy.mockRestore()
    })

    it('trash: updateEntry is called BEFORE frontmatter writes (optimistic)', async () => {
      const callOrder: string[] = []
      updateEntry.mockImplementation(() => { callOrder.push('updateEntry') })
      handleUpdateFrontmatter.mockImplementation(() => {
        callOrder.push('handleUpdateFrontmatter')
        return Promise.resolve()
      })
      const { result } = setup()

      await act(async () => {
        await result.current.handleTrashNote('/vault/note/test.md')
      })

      expect(callOrder[0]).toBe('updateEntry')
      expect(callOrder[1]).toBe('handleUpdateFrontmatter')
    })
  })

  describe('onBeforeAction callback', () => {
    function setupWithBeforeAction(onBeforeAction: ReturnType<typeof vi.fn>) {
      return renderHook(() =>
        useEntryActions({
          entries: [], updateEntry, handleUpdateFrontmatter, handleDeleteProperty,
          setToastMessage, createTypeEntry, onFrontmatterPersisted, onBeforeAction,
        })
      )
    }

    it('calls onBeforeAction before trashing a note', async () => {
      const callOrder: string[] = []
      const onBeforeAction = vi.fn().mockImplementation(() => {
        callOrder.push('beforeAction')
        return Promise.resolve()
      })
      handleUpdateFrontmatter.mockImplementation(() => {
        callOrder.push('updateFrontmatter')
        return Promise.resolve()
      })
      const { result } = setupWithBeforeAction(onBeforeAction)

      await act(async () => {
        await result.current.handleTrashNote('/vault/note/test.md')
      })

      expect(onBeforeAction).toHaveBeenCalledWith('/vault/note/test.md')
      expect(callOrder[0]).toBe('beforeAction')
      expect(callOrder[1]).toBe('updateFrontmatter')
    })

    it('calls onBeforeAction before archiving a note', async () => {
      const onBeforeAction = vi.fn().mockResolvedValue(undefined)
      const { result } = setupWithBeforeAction(onBeforeAction)

      await act(async () => {
        await result.current.handleArchiveNote('/vault/note/test.md')
      })

      expect(onBeforeAction).toHaveBeenCalledWith('/vault/note/test.md')
    })

    it.each([
      ['trash', 'handleTrashNote'] as const,
      ['archive', 'handleArchiveNote'] as const,
    ])('does not proceed with %s when onBeforeAction rejects', async (_label, method) => {
      const { result } = setupWithBeforeAction(vi.fn().mockRejectedValue(new Error('Save failed')))

      await expect(act(() => result.current[method]('/vault/note/test.md'))).rejects.toThrow('Save failed')

      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
    })
  })
})
