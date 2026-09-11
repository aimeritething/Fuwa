import { describe, expect, it } from 'vitest'
import { clampSidebarWidth, parseSession, restoreOpenEditors, sessionForOpenEditors } from './sessionSchema'

const A = '/Users/x/notes/a.md'
const B = '/Users/x/notes/b.md'
const C = '/Users/x/notes/c.md'

describe('parseSession', () => {
  it('reads the documented schema', () => {
    const raw = {
      version: 1,
      folder: '/Users/x/notes',
      openEditors: [{ path: A, mode: 'rich' }, { path: '/Users/x/notes/cover.png' }],
      activePath: A,
      theme: 'dark',
      sidebar: { collapsed: false, width: 260 },
      window: { x: 0, y: 0, width: 1200, height: 800 },
    }

    expect(parseSession(raw)).toEqual({
      version: 1,
      folder: '/Users/x/notes',
      openEditors: [{ path: A, mode: 'rich' }, { path: '/Users/x/notes/cover.png' }],
      activePath: A,
      theme: 'dark',
      sidebar: { collapsed: false, width: 260 },
    })
  })

  it('ignores a Session with an unknown version', () => {
    expect(parseSession({ version: 2, openEditors: [{ path: A }] })).toBeNull()
    expect(parseSession({ openEditors: [{ path: A }] })).toBeNull()
  })

  it('ignores anything that is not a Session object', () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession('session')).toBeNull()
    expect(parseSession([])).toBeNull()
  })

  it('drops malformed entries and falls back to the defaults for the rest', () => {
    const parsed = parseSession({
      version: 1,
      openEditors: [{ path: A, mode: 'sideways' }, { mode: 'rich' }, 'b.md', { path: B, mode: 'raw' }],
      activePath: 42,
      theme: 'sepia',
      sidebar: { collapsed: 'yes' },
    })

    expect(parsed).toEqual({
      version: 1,
      folder: null,
      openEditors: [{ path: A }, { path: B, mode: 'raw' }],
      activePath: null,
      theme: 'dark',
      sidebar: { collapsed: false, width: 260 },
    })
  })
})

describe('restoreOpenEditors', () => {
  const session = parseSession({
    version: 1,
    openEditors: [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }, { path: C, mode: 'rich' }],
    activePath: B,
  })!

  it('keeps every surviving Tab in order with the same active Tab', () => {
    expect(restoreOpenEditors(session, new Set([A, B, C]))).toEqual({
      openEditors: [{ path: A, mode: 'rich' }, { path: B, mode: 'rich' }, { path: C, mode: 'rich' }],
      activePath: B,
    })
  })

  it('drops a Tab whose file is gone and keeps the active Tab when it survives', () => {
    expect(restoreOpenEditors(session, new Set([B, C]))).toEqual({
      openEditors: [{ path: B, mode: 'rich' }, { path: C, mode: 'rich' }],
      activePath: B,
    })
  })

  it('activates the next surviving Tab in order when the active file is gone', () => {
    expect(restoreOpenEditors(session, new Set([A, C]))).toEqual({
      openEditors: [{ path: A, mode: 'rich' }, { path: C, mode: 'rich' }],
      activePath: C,
    })
  })

  it('falls back to the previous surviving Tab when nothing follows the active one', () => {
    const lastActive = { ...session, activePath: C }
    expect(restoreOpenEditors(lastActive, new Set([A]))).toEqual({
      openEditors: [{ path: A, mode: 'rich' }],
      activePath: A,
    })
  })

  it('restores an empty Session with no active Tab', () => {
    expect(restoreOpenEditors(session, new Set())).toEqual({ openEditors: [], activePath: null })
  })

  it('activates the first Tab when the Session names no active path', () => {
    const noActive = { ...session, activePath: null }
    expect(restoreOpenEditors(noActive, new Set([A, B, C])).activePath).toBe(A)
  })
})

describe('sessionForOpenEditors', () => {
  it('writes the Tabs in order as Rich Documents and the chosen theme, the other fields at their defaults', () => {
    expect(sessionForOpenEditors([{ path: B }, { path: A }], A, 'light')).toEqual({
      version: 1,
      folder: null,
      openEditors: [{ path: B, mode: 'rich' }, { path: A, mode: 'rich' }],
      activePath: A,
      theme: 'light',
      sidebar: { collapsed: false, width: 260 },
    })
  })

  it('writes each Document with its own mode (AIM-381)', () => {
    const session = sessionForOpenEditors([{ path: A, mode: 'raw' }, { path: B, mode: 'rich' }], A, 'dark')

    expect(session.openEditors).toEqual([{ path: A, mode: 'raw' }, { path: B, mode: 'rich' }])
  })

  it('leaves an Image file entry without a mode, its kind being the extension', () => {
    const session = sessionForOpenEditors([{ path: A }, { path: '/Users/x/notes/cover.png', mode: 'raw' }], A, 'dark')

    expect(session.openEditors).toEqual([{ path: A, mode: 'rich' }, { path: '/Users/x/notes/cover.png' }])
  })

  it('writes system when the appearance follows the OS', () => {
    expect(sessionForOpenEditors([], null, 'system').theme).toBe('system')
  })

  it('writes the sidebar state it is given', () => {
    const session = sessionForOpenEditors([{ path: A }], A, 'dark', '/Users/x/notes', { collapsed: true, width: 320 })

    expect(session.folder).toBe('/Users/x/notes')
    expect(session.sidebar).toEqual({ collapsed: true, width: 320 })
  })
})

describe('the sidebar width', () => {
  it('is clamped to the range the sidebar can actually take, whether restored or written', () => {
    expect(clampSidebarWidth(20)).toBe(180)
    expect(clampSidebarWidth(9000)).toBe(480)
    expect(clampSidebarWidth(300.6)).toBe(301)
    expect(parseSession({ version: 1, sidebar: { collapsed: true, width: 20 } })?.sidebar).toEqual({ collapsed: true, width: 180 })
  })
})
