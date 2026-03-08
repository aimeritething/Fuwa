import { describe, it, expect } from 'vitest'
import { fuzzyMatch, searchRank, bestSearchRank } from './fuzzyMatch'

describe('fuzzyMatch', () => {
  it('matches exact string', () => {
    const result = fuzzyMatch('hello', 'hello')
    expect(result.match).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('matches case-insensitively', () => {
    expect(fuzzyMatch('hello', 'Hello World').match).toBe(true)
  })

  it('matches subsequence chars in order', () => {
    expect(fuzzyMatch('cnt', 'Create New Type').match).toBe(true)
  })

  it('rejects when chars are not all present', () => {
    expect(fuzzyMatch('xyz', 'hello').match).toBe(false)
  })

  it('rejects when chars are out of order', () => {
    expect(fuzzyMatch('ba', 'abc').match).toBe(false)
  })

  it('returns higher score for consecutive matches', () => {
    const consecutive = fuzzyMatch('com', 'Commit & Push')
    const scattered = fuzzyMatch('cmt', 'Commit & Push')
    expect(consecutive.score).toBeGreaterThan(scattered.score)
  })

  it('gives bonus for word-start matches', () => {
    const wordStart = fuzzyMatch('cp', 'Commit Push')
    const midWord = fuzzyMatch('om', 'Commit Push')
    expect(wordStart.score).toBeGreaterThan(midWord.score)
  })

  it('matches empty query against any string', () => {
    expect(fuzzyMatch('', 'anything').match).toBe(true)
  })

  it('handles empty target', () => {
    expect(fuzzyMatch('a', '').match).toBe(false)
  })
})

describe('searchRank', () => {
  it('returns 0 for exact match', () => {
    expect(searchRank('Refactoring', 'Refactoring')).toBe(0)
  })

  it('returns 0 for case-insensitive exact match', () => {
    expect(searchRank('refactoring', 'Refactoring')).toBe(0)
  })

  it('returns 1 for prefix match', () => {
    expect(searchRank('Refactoring', 'Refactoring Ideas')).toBe(1)
  })

  it('returns 1 for case-insensitive prefix match', () => {
    expect(searchRank('quarter', 'Quarter Review')).toBe(1)
  })

  it('returns 2 for non-prefix fuzzy match', () => {
    expect(searchRank('Ideas', 'Refactoring Ideas')).toBe(2)
  })
})

describe('bestSearchRank', () => {
  it('returns best rank across title and aliases', () => {
    expect(bestSearchRank('ref', 'Refactoring Notes', ['ref'])).toBe(0)
  })

  it('returns title rank when no aliases match better', () => {
    expect(bestSearchRank('Refactoring', 'Refactoring', [])).toBe(0)
  })

  it('prefers alias exact match over title prefix match', () => {
    expect(bestSearchRank('ref', 'Reference Manual', ['ref'])).toBe(0)
  })

  it('returns 2 when nothing matches as exact or prefix', () => {
    expect(bestSearchRank('ideas', 'Refactoring Ideas', ['thoughts'])).toBe(2)
  })
})
