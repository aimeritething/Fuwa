import { describe, expect, it } from 'vitest'
import {
  looksLikeLocalFileReference,
  shouldAutoLinkHref,
} from './editor-link-autolink'

describe('looksLikeLocalFileReference', () => {
  it('treats bare filenames with file extensions as local file references', () => {
    expect(looksLikeLocalFileReference({ raw: 'AGENTS.md' })).toBe(true)
    expect(looksLikeLocalFileReference({ raw: 'README.txt' })).toBe(true)
  })

  it('treats local path-like filenames as local file references', () => {
    expect(looksLikeLocalFileReference({ raw: 'docs/README.md' })).toBe(true)
    expect(looksLikeLocalFileReference({ raw: './docs/README.md' })).toBe(true)
    expect(looksLikeLocalFileReference({ raw: '/vault/README.md' })).toBe(true)
  })

  it('does not classify domain-based urls as local file references', () => {
    expect(looksLikeLocalFileReference({ raw: 'https://example.com/README.md' })).toBe(false)
    expect(looksLikeLocalFileReference({ raw: 'example.com/README.md' })).toBe(false)
    expect(looksLikeLocalFileReference({ raw: 'www.example.com/README.md' })).toBe(false)
  })
})

describe('shouldAutoLinkHref', () => {
  it('rejects plain filename-like text', () => {
    expect(shouldAutoLinkHref({ raw: 'AGENTS.md' })).toBe(false)
    expect(shouldAutoLinkHref({ raw: 'docs/README.md' })).toBe(false)
  })

  it('keeps normal url-like values eligible for autolinking', () => {
    expect(shouldAutoLinkHref({ raw: 'https://example.com/docs' })).toBe(true)
    expect(shouldAutoLinkHref({ raw: 'example.com' })).toBe(true)
    expect(shouldAutoLinkHref({ raw: 'example.com/README.md' })).toBe(true)
  })
})
