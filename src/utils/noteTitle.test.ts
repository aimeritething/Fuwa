import { describe, expect, it } from 'vitest'
import { deriveDisplayTitleState, extractH1TitleFromContent, filenameStemToTitle } from './noteTitle'

describe('filenameStemToTitle', () => {
  it('converts kebab-case filenames into title case', () => {
    expect(filenameStemToTitle('renamed-note.md')).toBe('Renamed Note')
  })
})

describe('extractH1TitleFromContent', () => {
  it('extracts the first H1 after frontmatter', () => {
    const content = '---\ntitle: Legacy Title\n---\n# Updated Title\n\nBody'
    expect(extractH1TitleFromContent(content)).toBe('Updated Title')
  })

  it('strips markdown formatting from the H1', () => {
    const content = '# **Bold** [Link](https://example.com) and `code`'
    expect(extractH1TitleFromContent(content)).toBe('Bold Link and code')
  })

  it('returns null when the first non-empty line is not an H1', () => {
    expect(extractH1TitleFromContent('Body first\n# Not the title')).toBeNull()
  })
})

describe('deriveDisplayTitleState', () => {
  it('prefers H1 over frontmatter title and filename', () => {
    const content = '---\ntitle: Legacy Title\n---\n# Updated Title\n\nBody'
    expect(deriveDisplayTitleState(content, 'legacy-title.md', 'Legacy Title')).toEqual({
      title: 'Updated Title',
      hasH1: true,
    })
  })

  it('falls back to frontmatter title when no H1 is present', () => {
    const content = '---\ntitle: Legacy Title\n---\nBody'
    expect(deriveDisplayTitleState(content, 'legacy-title.md', 'Legacy Title')).toEqual({
      title: 'Legacy Title',
      hasH1: false,
    })
  })

  it('falls back to filename title when there is no H1 or frontmatter title', () => {
    expect(deriveDisplayTitleState('Body only', 'renamed-note.md')).toEqual({
      title: 'Renamed Note',
      hasH1: false,
    })
  })
})
