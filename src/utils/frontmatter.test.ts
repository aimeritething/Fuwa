import { describe, it, expect } from 'vitest'
import { parseFrontmatter, detectFrontmatterState } from './frontmatter'

describe('parseFrontmatter', () => {
  describe('boolean-like Yes/No values', () => {
    it('parses Archived: Yes as true', () => {
      const fm = parseFrontmatter('---\nArchived: Yes\n---\nBody')
      expect(fm['Archived']).toBe(true)
    })

    it('parses Archived: No as false', () => {
      const fm = parseFrontmatter('---\nArchived: No\n---\nBody')
      expect(fm['Archived']).toBe(false)
    })

    it('parses Trashed: Yes as true', () => {
      const fm = parseFrontmatter('---\nTrashed: Yes\n---\nBody')
      expect(fm['Trashed']).toBe(true)
    })

    it('parses Trashed: No as false', () => {
      const fm = parseFrontmatter('---\nTrashed: No\n---\nBody')
      expect(fm['Trashed']).toBe(false)
    })

    it('parses yes (lowercase) as true', () => {
      const fm = parseFrontmatter('---\nArchived: yes\n---\nBody')
      expect(fm['Archived']).toBe(true)
    })

    it('parses no (lowercase) as false', () => {
      const fm = parseFrontmatter('---\nArchived: no\n---\nBody')
      expect(fm['Archived']).toBe(false)
    })

    it('still parses true as true', () => {
      const fm = parseFrontmatter('---\nArchived: true\n---\nBody')
      expect(fm['Archived']).toBe(true)
    })

    it('still parses false as false', () => {
      const fm = parseFrontmatter('---\nArchived: false\n---\nBody')
      expect(fm['Archived']).toBe(false)
    })
  })
})

describe('detectFrontmatterState', () => {
  it('returns "none" for null content', () => {
    expect(detectFrontmatterState(null)).toBe('none')
  })

  it('returns "none" when no --- block exists', () => {
    expect(detectFrontmatterState('Just a plain markdown file')).toBe('none')
  })

  it('returns "empty" for empty frontmatter block', () => {
    expect(detectFrontmatterState('---\n---\nBody')).toBe('empty')
  })

  it('returns "empty" for whitespace-only frontmatter', () => {
    expect(detectFrontmatterState('---\n  \n---\nBody')).toBe('empty')
  })

  it('returns "valid" for well-formed frontmatter', () => {
    expect(detectFrontmatterState('---\ntitle: Hello\ntype: Note\n---\nBody')).toBe('valid')
  })

  it('returns "valid" for frontmatter with only a title', () => {
    expect(detectFrontmatterState('---\ntitle: Test\n---\n')).toBe('valid')
  })

  it('returns "invalid" for malformed YAML (missing colon)', () => {
    expect(detectFrontmatterState('---\nthis is not yaml\n---\nBody')).toBe('invalid')
  })

  it('returns "invalid" for frontmatter with only garbage text', () => {
    expect(detectFrontmatterState('---\n{broken: [yaml\n---\nBody')).toBe('invalid')
  })
})
