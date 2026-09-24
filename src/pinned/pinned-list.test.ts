import { describe, expect, it } from 'vitest'
import type { ListedFile } from '@/folder/explorer'
import {
  isPinnable,
  movePinned,
  parsePinnedLists,
  pinPath,
  pinnedIn,
  prunePinned,
  retargetPinned,
  unpinPath,
  withPinnedIn,
} from './pinned-list'

const FOLDER = '/Notes'
const A = `${FOLDER}/a.md`
const B = `${FOLDER}/b.md`
const C = `${FOLDER}/c.md`
const LAKE = `${FOLDER}/images/lake.png`
const PLAN = `${FOLDER}/Projects/plan.md`

function listed(path: string, kind: ListedFile['kind']): ListedFile {
  return { path, kind, modifiedAt: null, fileSize: 0 }
}

const FILES = [
  listed(A, 'note'), listed(B, 'note'), listed(C, 'note'),
  listed(`${FOLDER}/images`, 'folder'), listed(LAKE, 'image'),
  listed(`${FOLDER}/Projects`, 'folder'), listed(PLAN, 'note'),
]

describe('what can be pinned', () => {
  it('is a Document or an Image file the Folder lists', () => {
    expect(isPinnable(A, FOLDER, FILES)).toBe(true)
    expect(isPinnable(LAKE, FOLDER, FILES)).toBe(true)
  })

  it('is never a sub-folder, the Folder itself, a file outside it, or anything with no Folder open', () => {
    expect(isPinnable(`${FOLDER}/images`, FOLDER, FILES)).toBe(false)
    expect(isPinnable(FOLDER, FOLDER, FILES)).toBe(false)
    expect(isPinnable('/Elsewhere/loose.md', FOLDER, [...FILES, listed('/Elsewhere/loose.md', 'note')])).toBe(false)
    expect(isPinnable(`${FOLDER}/unlisted.md`, FOLDER, FILES)).toBe(false)
    expect(isPinnable(A, null, FILES)).toBe(false)
  })
})

describe('Pin, Unpin and the order', () => {
  it('appends a pin at the end and never pins a path twice', () => {
    const list = pinPath(pinPath([], B), A)
    expect(list).toEqual([B, A])
    expect(pinPath(list, B)).toBe(list)
  })

  it('unpins one path and leaves the rest in order', () => {
    expect(unpinPath([A, B, C], B)).toEqual([A, C])
    const list = [A]
    expect(unpinPath(list, C)).toBe(list)
  })

  it('moves a row before another, or to the end', () => {
    expect(movePinned([A, B, C], C, A)).toEqual([C, A, B])
    expect(movePinned([A, B, C], A, C)).toEqual([B, A, C])
    expect(movePinned([A, B, C], A, null)).toEqual([B, C, A])
  })

  it('changes nothing for a drop on the row\'s own place or an unknown path', () => {
    const list = [A, B, C]
    expect(movePinned(list, B, B)).toBe(list)
    expect(movePinned(list, B, C)).toBe(list)
    expect(movePinned(list, C, null)).toBe(list)
    expect(movePinned(list, `${FOLDER}/z.md`, A)).toBe(list)
    expect(movePinned(list, A, `${FOLDER}/z.md`)).toBe(list)
  })
})

describe('a rename or move made in Plumo', () => {
  it('carries a renamed file\'s pin along, in its place', () => {
    expect(retargetPinned([A, B, C], B, `${FOLDER}/bee.md`, FOLDER)).toEqual([A, `${FOLDER}/bee.md`, C])
  })

  it('carries every pin under a renamed folder along', () => {
    expect(retargetPinned([PLAN, A, LAKE], `${FOLDER}/Projects`, `${FOLDER}/Work`, FOLDER))
      .toEqual([`${FOLDER}/Work/plan.md`, A, LAKE])
  })

  it('carries a file moved into a sub-folder along', () => {
    expect(retargetPinned([A, B], A, `${FOLDER}/Projects/a.md`, FOLDER)).toEqual([`${FOLDER}/Projects/a.md`, B])
  })

  it('does not mistake a sibling that shares a name prefix for a file under the folder', () => {
    const list = [`${FOLDER}/Projects-old.md`]
    expect(retargetPinned(list, `${FOLDER}/Projects`, `${FOLDER}/Work`, FOLDER)).toBe(list)
  })

  it('unpins a file that lands outside the Folder', () => {
    expect(retargetPinned([A, B], A, '/Elsewhere/a.md', FOLDER)).toEqual([B])
  })
})

describe('a file that leaves the Folder or disappears from disk', () => {
  it('is unpinned once the listing no longer holds it', () => {
    const withoutB = FILES.filter((file) => file.path !== B)
    expect(prunePinned([A, B, LAKE], withoutB)).toEqual([A, LAKE])
  })

  it('goes when a folder took its path', () => {
    expect(prunePinned([A], [listed(A, 'folder')])).toEqual([])
  })

  it('leaves the list itself alone when everything is still there', () => {
    const list = [A, LAKE]
    expect(prunePinned(list, FILES)).toBe(list)
  })
})

describe('one list per Folder', () => {
  it('reads and replaces one Folder\'s list without touching another\'s', () => {
    const lists = { [FOLDER]: [A], '/Work': ['/Work/plan.md'] }
    const next = withPinnedIn(lists, FOLDER, [A, B])

    expect(pinnedIn(next, FOLDER)).toEqual([A, B])
    expect(pinnedIn(next, '/Work')).toEqual(['/Work/plan.md'])
    expect(pinnedIn(next, null)).toEqual([])
    expect(pinnedIn(next, '/Other')).toEqual([])
  })

  it('drops a Folder\'s key once its list is empty, and keeps the same object for no change', () => {
    const lists = { [FOLDER]: [A] }
    expect(withPinnedIn(lists, FOLDER, [])).toEqual({})
    expect(withPinnedIn(lists, FOLDER, lists[FOLDER])).toBe(lists)
  })

  it('reads the Session\'s lists defensively', () => {
    expect(parsePinnedLists({ [FOLDER]: [A, A, 3, '/Elsewhere/x.md'], '/Work': [] })).toEqual({ [FOLDER]: [A] })
    expect(parsePinnedLists(null)).toEqual({})
    expect(parsePinnedLists([A])).toEqual({})
  })
})
