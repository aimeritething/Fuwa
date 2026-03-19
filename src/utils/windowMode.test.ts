import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isNoteWindow, getNoteWindowParams } from './windowMode'

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
})
