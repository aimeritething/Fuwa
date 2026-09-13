import { describe, expect, it } from 'vitest'
import {
  looksLikeLocalFileReference,
  shouldStripAutoLinkedLocalFileMark,
  shouldAutoLinkHref,
} from './editorLinkAutolink'

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

describe('shouldStripAutoLinkedLocalFileMark', () => {
  it('strips accidental link marks that mirror local file text', () => {
    expect(shouldStripAutoLinkedLocalFileMark({
      href: { raw: 'https://AGENTS.md' },
      text: { raw: 'AGENTS.md' },
    })).toBe(true)
    expect(shouldStripAutoLinkedLocalFileMark({
      href: { raw: 'https://docs/README.md' },
      text: { raw: 'docs/README.md' },
    })).toBe(true)
  })

  it('keeps intentional external links', () => {
    expect(shouldStripAutoLinkedLocalFileMark({
      href: { raw: 'https://example.com/docs' },
      text: { raw: 'Example Docs' },
    })).toBe(false)
    expect(shouldStripAutoLinkedLocalFileMark({
      href: { raw: 'https://example.com/agents' },
      text: { raw: 'AGENTS.md' },
    })).toBe(false)
  })
})
