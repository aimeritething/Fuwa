import { describe, expect, it } from 'vitest'
import { documentFrontmatter, frontmatterForcesRaw } from './frontmatter-status'

describe('documentFrontmatter', () => {
  it('reports no Frontmatter for a plain Document', () => {
    expect(documentFrontmatter('# Title\n\nBody\n')).toEqual({ kind: 'none' })
    expect(documentFrontmatter('')).toEqual({ kind: 'none' })
  })

  it('reads a block with nested and list lines as valid', () => {
    const content = '---\ntitle: Plumo\ntags:\n  - a\n  - b\nmeta:\n  nested: yes\n---\n# Plumo\n'
    expect(documentFrontmatter(content)).toEqual({ kind: 'valid' })
  })

  it('reads CRLF line endings', () => {
    expect(documentFrontmatter('---\r\ntitle: Plumo\r\n---\r\n# Plumo\r\n')).toEqual({ kind: 'valid' })
  })

  it('accepts quoted and non-ASCII keys, the shape the kernel parser reads', () => {
    expect(documentFrontmatter('---\n"quoted key": 1\ntítulo: Plumo\n1st: x\n---\n')).toEqual({ kind: 'valid' })
  })

  it('treats an empty or comment-only block as valid', () => {
    expect(documentFrontmatter('---\n---\n# Plumo\n')).toEqual({ kind: 'valid' })
    expect(documentFrontmatter('---\n# just a comment\n\n---\n# Plumo\n')).toEqual({ kind: 'valid' })
  })

  it('is invalid when the block is never closed', () => {
    expect(documentFrontmatter('---\ntitle: Plumo\n# Plumo\n')).toMatchObject({ kind: 'invalid' })
  })

  it('is invalid when no line is a key', () => {
    expect(documentFrontmatter('---\nthis is not yaml\n---\n# Plumo\n')).toMatchObject({ kind: 'invalid' })
  })

  it('is invalid when the block is indented with tabs', () => {
    expect(documentFrontmatter('---\ntitle: Plumo\n\tnested: x\n---\n')).toMatchObject({ kind: 'invalid' })
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
