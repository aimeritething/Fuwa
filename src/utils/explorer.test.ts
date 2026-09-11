import { describe, expect, it } from 'vitest'
import { buildExplorerTree, documentLocation, type ListedFile } from './explorer'

const file = (path: string, kind: ListedFile['kind']): ListedFile => ({ path, kind, modifiedAt: 1, fileSize: 3 })

describe('Explorer listing', () => {
  it('places folders before files, case-insensitively by name, and excludes outside files', () => {
    const tree = buildExplorerTree('/Notes', [
      file('/Notes/z.md', 'note'), file('/Notes/B.md', 'note'), file('/Notes/a.png', 'image'),
      file('/Notes/Zebra', 'folder'), file('/Notes/alpha', 'folder'),
      file('/Notes/alpha/nested.md', 'note'), file('/Notes-other/outside.md', 'note'),
    ])
    expect(tree.children.map((node) => node.name)).toEqual(['alpha', 'Zebra', 'a.png', 'B.md', 'z.md'])
    expect(tree.children[0].children.map((node) => node.name)).toEqual(['nested.md'])
    expect(tree.children[2].entry).toMatchObject({ fileKind: 'binary', modifiedAt: 1, fileSize: 3 })
  })

  it('uses the full Folder breadcrumb inside and only the parent outside', () => {
    expect(documentLocation('/Notes/sub/deep/a.md', '/Notes')).toEqual({
      insideFolder: true, parents: ['Notes', 'sub', 'deep'], filename: 'a.md', parent: 'deep',
    })
    expect(documentLocation('/Notes-other/a.md', '/Notes')).toEqual({
      insideFolder: false, parents: ['Notes-other'], filename: 'a.md', parent: 'Notes-other',
    })
  })
})
