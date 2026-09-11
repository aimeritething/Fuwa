import { describe, expect, it } from 'vitest'
import { EXPLORER_MENU_LABELS, explorerMenuEntries } from './explorerMenuItems'

function labels(target: Parameters<typeof explorerMenuEntries>[0]): string[] {
  return explorerMenuEntries(target).map((entry) =>
    entry.kind === 'separator' ? '─' : EXPLORER_MENU_LABELS[entry.action])
}

describe('explorerMenuEntries', () => {
  it('gives a Document rename, trash and the system hand-offs', () => {
    expect(labels('note')).toEqual(['Rename…', 'Move to Trash', '─', 'Reveal in Finder', 'Copy Path'])
  })

  it('gives an Image file the same items as a Document', () => {
    expect(labels('image')).toEqual(labels('note'))
  })

  it('gives a folder the creation items above its own', () => {
    expect(labels('folder')).toEqual([
      'New Document', 'New Folder', '─', 'Rename…', 'Move to Trash', '─', 'Reveal in Finder', 'Copy Path',
    ])
  })

  it('gives the root row no rename and no trash', () => {
    expect(labels('root')).toEqual(['New Document', 'New Folder', '─', 'Reveal in Finder', 'Copy Path'])
  })

  it('gives the empty area below the tree the two creation items only', () => {
    expect(labels('empty')).toEqual(['New Document', 'New Folder'])
  })

  it('never puts a separator at either end', () => {
    for (const target of ['note', 'image', 'folder', 'root', 'empty'] as const) {
      const entries = explorerMenuEntries(target)
      expect(entries.at(0)?.kind).toBe('item')
      expect(entries.at(-1)?.kind).toBe('item')
    }
  })
})
