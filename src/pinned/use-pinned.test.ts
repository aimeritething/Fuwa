import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ListedFile } from '@/folder/explorer'
import { usePinned } from './use-pinned'

const NOTES = '/Notes'
const WORK = '/Work'
const A = `${NOTES}/a.md`
const B = `${NOTES}/b.md`
const LAKE = `${NOTES}/images/lake.png`
const PLAN = `${WORK}/plan.md`

function listed(path: string, kind: ListedFile['kind'] = 'note'): ListedFile {
  return { path, kind, modifiedAt: null, fileSize: 0 }
}

const NOTES_FILES = [listed(A), listed(B), listed(`${NOTES}/images`, 'folder'), listed(LAKE, 'image')]
const WORK_FILES = [listed(PLAN)]

interface Props {
  folder: string | null
  files: readonly ListedFile[]
}

function renderPinned(initial: Props = { folder: NOTES, files: NOTES_FILES }) {
  return renderHook(({ folder, files }: Props) => usePinned(folder, files), { initialProps: initial })
}

describe('usePinned', () => {
  it('pins and unpins the open Folder\'s Documents and Image files, in the order they were pinned', () => {
    const { result } = renderPinned()

    act(() => result.current.toggle(LAKE))
    act(() => result.current.toggle(A))
    expect(result.current.paths).toEqual([LAKE, A])
    expect(result.current.isPinned(A)).toBe(true)
    expect(result.current.lists).toEqual({ [NOTES]: [LAKE, A] })

    act(() => result.current.toggle(LAKE))
    expect(result.current.paths).toEqual([A])
  })

  it('refuses a sub-folder and a file outside the Folder', () => {
    const { result } = renderPinned()

    expect(result.current.canPin(`${NOTES}/images`)).toBe(false)
    expect(result.current.canPin('/Elsewhere/loose.md')).toBe(false)
    act(() => result.current.toggle(`${NOTES}/images`))
    act(() => result.current.toggle('/Elsewhere/loose.md'))
    expect(result.current.paths).toEqual([])
  })

  it('reorders by the drag', () => {
    const { result } = renderPinned()
    act(() => result.current.toggle(A))
    act(() => result.current.toggle(B))
    act(() => result.current.toggle(LAKE))

    act(() => result.current.move(LAKE, A))
    expect(result.current.paths).toEqual([LAKE, A, B])
  })

  it('keeps each Folder\'s list: another Folder starts empty, and the first gets its pins back', () => {
    const { result, rerender } = renderPinned()
    act(() => result.current.toggle(B))
    act(() => result.current.toggle(A))

    rerender({ folder: WORK, files: WORK_FILES })
    expect(result.current.paths).toEqual([])
    act(() => result.current.toggle(PLAN))

    rerender({ folder: NOTES, files: NOTES_FILES })
    expect(result.current.paths).toEqual([B, A])
    expect(result.current.lists).toEqual({ [NOTES]: [B, A], [WORK]: [PLAN] })
  })

  it('follows a rename made in Plumo before the listing catches up, and keeps the pin once it has', () => {
    const { result, rerender } = renderPinned()
    act(() => result.current.toggle(A))
    act(() => result.current.toggle(B))

    const renamed = `${NOTES}/alpha.md`
    act(() => result.current.retarget(A, renamed))
    expect(result.current.paths).toEqual([renamed, B])

    rerender({ folder: NOTES, files: NOTES_FILES.map((file) => (file.path === A ? listed(renamed) : file)) })
    expect(result.current.paths).toEqual([renamed, B])
  })

  it('follows a move into a sub-folder, and every pin under a renamed folder', () => {
    const { result } = renderPinned()
    act(() => result.current.toggle(LAKE))
    act(() => result.current.toggle(A))

    act(() => result.current.retarget(`${NOTES}/images`, `${NOTES}/pictures`))
    act(() => result.current.retarget(A, `${NOTES}/images/a.md`))
    expect(result.current.paths).toEqual([`${NOTES}/pictures/lake.png`, `${NOTES}/images/a.md`])
  })

  it('unpins a file deleted in Finder once the listing no longer holds it', () => {
    const { result, rerender } = renderPinned()
    act(() => result.current.toggle(A))
    act(() => result.current.toggle(B))

    rerender({ folder: NOTES, files: NOTES_FILES.filter((file) => file.path !== A) })
    expect(result.current.paths).toEqual([B])
    expect(result.current.lists).toEqual({ [NOTES]: [B] })
  })

  it('checks restored pins against the Folder\'s listing, whether the listing lands first or last', () => {
    const stored = { [NOTES]: [A, `${NOTES}/gone.md`], [WORK]: [PLAN] }

    const before = renderPinned({ folder: null, files: [] })
    act(() => before.result.current.restore(stored))
    expect(before.result.current.paths).toEqual([])
    before.rerender({ folder: NOTES, files: NOTES_FILES })
    expect(before.result.current.lists).toEqual({ [NOTES]: [A], [WORK]: [PLAN] })

    const after = renderPinned()
    act(() => after.result.current.restore(stored))
    expect(after.result.current.lists).toEqual({ [NOTES]: [A], [WORK]: [PLAN] })
  })

  it('does nothing with no Folder open', () => {
    const { result } = renderPinned({ folder: null, files: [] })

    act(() => result.current.toggle(A))
    expect(result.current.paths).toEqual([])
    expect(result.current.lists).toEqual({})
  })
})
