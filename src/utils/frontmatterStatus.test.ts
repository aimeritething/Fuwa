import { describe, expect, it } from 'vitest'
import { documentFrontmatter, frontmatterBadgeLabel, frontmatterForcesRaw } from './frontmatterStatus'

describe('documentFrontmatter', () => {
  it('reports no Frontmatter for a plain Document', () => {
    expect(documentFrontmatter('# Title\n\nBody\n')).toEqual({ kind: 'none' })
    expect(documentFrontmatter('')).toEqual({ kind: 'none' })
  })

  it('counts the top-level keys of a valid block, not the nested or list lines', () => {
    const content = '---\ntitle: Fuwa\ntags:\n  - a\n  - b\nmeta:\n  nested: yes\n---\n# Fuwa\n'
    expect(documentFrontmatter(content)).toEqual({ kind: 'valid', keyCount: 3 })
  })

  it('counts a single key and reads CRLF line endings', () => {
    expect(documentFrontmatter('---\r\ntitle: Fuwa\r\n---\r\n# Fuwa\r\n')).toEqual({ kind: 'valid', keyCount: 1 })
  })

  it('accepts quoted and non-ASCII keys, the shape the kernel parser reads', () => {
    expect(documentFrontmatter('---\n"quoted key": 1\ntítulo: Fuwa\n1st: x\n---\n')).toEqual({ kind: 'valid', keyCount: 3 })
  })

  it('treats an empty or comment-only block as valid with no keys', () => {
    expect(documentFrontmatter('---\n---\n# Fuwa\n')).toEqual({ kind: 'valid', keyCount: 0 })
    expect(documentFrontmatter('---\n# just a comment\n\n---\n# Fuwa\n')).toEqual({ kind: 'valid', keyCount: 0 })
  })

  it('is invalid when the block is never closed', () => {
    expect(documentFrontmatter('---\ntitle: Fuwa\n# Fuwa\n')).toMatchObject({ kind: 'invalid' })
  })

  it('is invalid when no line is a key', () => {
    expect(documentFrontmatter('---\nthis is not yaml\n---\n# Fuwa\n')).toMatchObject({ kind: 'invalid' })
  })

  it('is invalid when the block is indented with tabs', () => {
    expect(documentFrontmatter('---\ntitle: Fuwa\n\tnested: x\n---\n')).toMatchObject({ kind: 'invalid' })
  })

  it('does not mistake a thematic break further down for Frontmatter', () => {
    expect(documentFrontmatter('# Title\n\n---\n\ntext\n')).toEqual({ kind: 'none' })
  })
})

describe('frontmatterForcesRaw', () => {
  it('forces Raw only for an invalid block', () => {
    expect(frontmatterForcesRaw('---\nnot yaml\n---\n')).toBe(true)
    expect(frontmatterForcesRaw('---\ntitle: x\n---\n')).toBe(false)
    expect(frontmatterForcesRaw('# no block\n')).toBe(false)
  })
})

describe('frontmatterBadgeLabel', () => {
  it('names the key count, singular and plural, and the invalid case', () => {
    expect(frontmatterBadgeLabel({ kind: 'none' })).toBeNull()
    expect(frontmatterBadgeLabel({ kind: 'valid', keyCount: 1 })).toBe('frontmatter · 1 key')
    expect(frontmatterBadgeLabel({ kind: 'valid', keyCount: 3 })).toBe('frontmatter · 3 keys')
    expect(frontmatterBadgeLabel({ kind: 'valid', keyCount: 0 })).toBe('frontmatter · 0 keys')
    expect(frontmatterBadgeLabel({ kind: 'invalid', reason: 'unclosed' })).toBe('frontmatter · invalid')
  })
})
