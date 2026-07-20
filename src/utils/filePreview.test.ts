import { describe, expect, it } from 'vitest'
import { entrySupportsPreviewSourceToggle } from './filePreview'

describe('entrySupportsPreviewSourceToggle', () => {
  it.each([
    ['note.md', true],
    ['report.html', true],
    ['REPORT.HTM', true],
    ['styles.css', false],
    ['diagram.svg', false],
  ])('returns %s support as %s', (filename, expected) => {
    expect(entrySupportsPreviewSourceToggle({ filename, path: `/vault/${filename}` })).toBe(expected)
  })
})
