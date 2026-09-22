import { describe, expect, it } from 'vitest'
import { noteEntryForPath, noteRootForPath } from './note-entry'

describe('noteRootForPath', () => {
  it('uses the Document\'s own directory as the boundary root', () => {
    expect(noteRootForPath('/Users/plumo/Documents/Notes/Welcome.md')).toBe('/Users/plumo/Documents/Notes')
  })

  it('keeps a Windows-style parent directory', () => {
    expect(noteRootForPath('C:\\Notes\\Plan.md')).toBe('C:\\Notes')
  })
})

describe('noteEntryForPath', () => {
  it('describes an opened Markdown file by its filename and stem', () => {
    const entry = noteEntryForPath('/Users/plumo/Documents/Notes/Reading list.md', '# Reading list\n')

    expect(entry.path).toBe('/Users/plumo/Documents/Notes/Reading list.md')
    expect(entry.filename).toBe('Reading list.md')
    expect(entry.title).toBe('Reading list')
    expect(entry.fileKind).toBe('markdown')
    expect(entry.fileSize).toBe('# Reading list\n'.length)
    expect(entry.hasH1).toBe(true)
  })

  it('reports no H1 when the body does not start with one', () => {
    expect(noteEntryForPath('/n/plain.md', 'Just text\n').hasH1).toBe(false)
  })
})
