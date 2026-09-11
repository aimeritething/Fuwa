import { describe, expect, it } from 'vitest'
import { resolveExternalTabChanges } from './externalTabChanges'

const FOLDER = '/Notes'

function resolve(input: {
  tabPaths: string[]
  changedPaths: string[]
  listedPaths?: string[]
  folder?: string | null
}) {
  return resolveExternalTabChanges({
    folder: FOLDER,
    listedPaths: [],
    ...input,
  })
}

describe('a Tab whose file is still there', () => {
  it('reloads it', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/a.md`],
      listedPaths: [`${FOLDER}/a.md`],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'reload' }])
  })

  it('leaves a Tab no changed path touches alone', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`, `${FOLDER}/b.md`],
      changedPaths: [`${FOLDER}/b.md`],
      listedPaths: [`${FOLDER}/a.md`, `${FOLDER}/b.md`],
    })).toEqual([{ path: `${FOLDER}/b.md`, kind: 'reload' }])
  })

  it('takes an event with no paths as touching every Tab', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [],
      listedPaths: [`${FOLDER}/a.md`],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'reload' }])
  })
})

describe('a Tab whose file has gone', () => {
  it('closes it when it was deleted', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/a.md`],
      listedPaths: [],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'close' }])
  })

  it('follows a move to a sibling folder: one changed path carries the same name', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/a.md`, `${FOLDER}/docs/a.md`],
      listedPaths: [`${FOLDER}/docs`, `${FOLDER}/docs/a.md`],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'retarget', newPath: `${FOLDER}/docs/a.md` }])
  })

  it('closes it on a rename: the new name is a fresh file, not this Tab', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/a.md`, `${FOLDER}/b.md`],
      listedPaths: [`${FOLDER}/b.md`],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'close' }])
  })

  it('closes it when two changed paths carry the same name', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/old/a.md`],
      changedPaths: [`${FOLDER}/old`, `${FOLDER}/one`, `${FOLDER}/two`],
      listedPaths: [`${FOLDER}/one/a.md`, `${FOLDER}/two/a.md`],
    })).toEqual([{ path: `${FOLDER}/old/a.md`, kind: 'close' }])
  })

  it('an Image file follows the same rule', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/lake.png`],
      changedPaths: [`${FOLDER}/lake.png`, `${FOLDER}/docs/lake.png`],
      listedPaths: [`${FOLDER}/docs/lake.png`],
    })).toEqual([{ path: `${FOLDER}/lake.png`, kind: 'retarget', newPath: `${FOLDER}/docs/lake.png` }])
  })
})

describe('a folder above the open Tabs', () => {
  it('retargets every Tab under a renamed folder', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/old/a.md`, `${FOLDER}/old/b.md`],
      changedPaths: [`${FOLDER}/old`, `${FOLDER}/new`],
      listedPaths: [`${FOLDER}/new`, `${FOLDER}/new/a.md`, `${FOLDER}/new/b.md`],
    })).toEqual([
      { path: `${FOLDER}/old/a.md`, kind: 'retarget', newPath: `${FOLDER}/new/a.md` },
      { path: `${FOLDER}/old/b.md`, kind: 'retarget', newPath: `${FOLDER}/new/b.md` },
    ])
  })

  it('follows the prefix rather than the name when two Tabs share a file name', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/old/a/notes.md`, `${FOLDER}/old/b/notes.md`],
      changedPaths: [`${FOLDER}/old`, `${FOLDER}/new`],
      listedPaths: [`${FOLDER}/new`, `${FOLDER}/new/a/notes.md`, `${FOLDER}/new/b/notes.md`],
    })).toEqual([
      { path: `${FOLDER}/old/a/notes.md`, kind: 'retarget', newPath: `${FOLDER}/new/a/notes.md` },
      { path: `${FOLDER}/old/b/notes.md`, kind: 'retarget', newPath: `${FOLDER}/new/b/notes.md` },
    ])
  })

  it('leaves a rename of the file itself to the same-name rule, which closes the Tab', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/a.md`, `${FOLDER}/b.md`],
      listedPaths: [`${FOLDER}/b.md`],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'close' }])
  })

  it('closes every Tab under a deleted folder', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/old/a.md`, `${FOLDER}/old/b.md`],
      changedPaths: [`${FOLDER}/old`],
      listedPaths: [],
    })).toEqual([
      { path: `${FOLDER}/old/a.md`, kind: 'close' },
      { path: `${FOLDER}/old/b.md`, kind: 'close' },
    ])
  })

  it('leaves a Tab under a folder that only gained a file alone', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/old/a.md`],
      changedPaths: [`${FOLDER}/old/fresh.md`],
      listedPaths: [`${FOLDER}/old`, `${FOLDER}/old/a.md`, `${FOLDER}/old/fresh.md`],
    })).toEqual([])
  })
})

describe('a Tab the changed paths do not name', () => {
  it('closes it anyway when the Folder no longer lists its file', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/b.md`],
      listedPaths: [`${FOLDER}/b.md`],
    })).toEqual([{ path: `${FOLDER}/a.md`, kind: 'close' }])
  })

  it('still leaves a listed file alone', () => {
    expect(resolve({
      tabPaths: [`${FOLDER}/a.md`],
      changedPaths: [`${FOLDER}/b.md`],
      listedPaths: [`${FOLDER}/a.md`, `${FOLDER}/b.md`],
    })).toEqual([])
  })
})

describe('a Document outside the Folder', () => {
  it('is reloaded rather than resolved from the listing, which never holds it', () => {
    expect(resolve({
      tabPaths: ['/Elsewhere/out.md'],
      changedPaths: ['/Elsewhere/out.md'],
      listedPaths: [],
    })).toEqual([{ path: '/Elsewhere/out.md', kind: 'reload' }])
  })

  it('is reloaded with no Folder open at all', () => {
    expect(resolve({
      folder: null,
      tabPaths: ['/Elsewhere/out.md'],
      changedPaths: ['/Elsewhere/out.md'],
    })).toEqual([{ path: '/Elsewhere/out.md', kind: 'reload' }])
  })
})
