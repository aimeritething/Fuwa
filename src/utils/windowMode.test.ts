import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { VaultEntry } from '../types'
import { isNoteWindow, getNoteWindowParams, findNoteWindowEntry, getNoteWindowPathCandidates } from './windowMode'

function makeEntry(path: string, title = 'Test Note'): VaultEntry {
  return {
    path,
    filename: path.split('/').pop() ?? 'test.md',
    title,
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  }
}

describe('windowMode', () => {
  let originalSearch: string

  beforeEach(() => {
    originalSearch = window.location.search
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: originalSearch },
    })
  })

  function setSearch(search: string) {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search },
    })
  }

  describe('isNoteWindow', () => {
    it('returns false when no query params', () => {
      setSearch('')
      expect(isNoteWindow()).toBe(false)
    })

    it('returns true when window=note', () => {
      setSearch('?window=note&path=/test.md&vault=/vault')
      expect(isNoteWindow()).toBe(true)
    })

    it('returns false for other window values', () => {
      setSearch('?window=main')
      expect(isNoteWindow()).toBe(false)
    })
  })

  describe('getNoteWindowParams', () => {
    it('returns null when not a note window', () => {
      setSearch('')
      expect(getNoteWindowParams()).toBeNull()
    })

    it('returns null when path is missing', () => {
      setSearch('?window=note&vault=/vault')
      expect(getNoteWindowParams()).toBeNull()
    })

    it('returns null when vault is missing', () => {
      setSearch('?window=note&path=/test.md')
      expect(getNoteWindowParams()).toBeNull()
    })

    it('returns params when all are present', () => {
      setSearch('?window=note&path=%2Fvault%2Ftest.md&vault=%2Fvault&title=My%20Note')
      expect(getNoteWindowParams()).toEqual({
        notePath: '/vault/test.md',
        vaultPath: '/vault',
        noteTitle: 'My Note',
      })
    })

    it('defaults title to Untitled', () => {
      setSearch('?window=note&path=/test.md&vault=/vault')
      const params = getNoteWindowParams()
      expect(params?.noteTitle).toBe('Untitled')
    })
  })

  describe('findNoteWindowEntry', () => {
    it('returns direct and vault-expanded path candidates', () => {
      expect(getNoteWindowPathCandidates({
        notePath: 'demo-vault-v2/untitled-note-29.md',
        vaultPath: '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2',
      })).toEqual([
        'demo-vault-v2/untitled-note-29.md',
        '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2/untitled-note-29.md',
      ])
    })

    it('matches an absolute note path against vault-relative entries', () => {
      const entry = makeEntry('demo-vault-v2/untitled-note-29.md')

      expect(findNoteWindowEntry([entry], {
        notePath: '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2/untitled-note-29.md',
        vaultPath: 'demo-vault-v2',
      })).toBe(entry)
    })

    it('matches a vault-relative note path against absolute entries', () => {
      const entry = makeEntry('/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2/untitled-note-29.md')

      expect(findNoteWindowEntry([entry], {
        notePath: 'demo-vault-v2/untitled-note-29.md',
        vaultPath: '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2',
      })).toBe(entry)
    })

    it('returns undefined when the target note is absent', () => {
      const entry = makeEntry('/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2/other-note.md')

      expect(findNoteWindowEntry([entry], {
        notePath: '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2/untitled-note-29.md',
        vaultPath: '/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2',
      })).toBeUndefined()
    })
  })
})
