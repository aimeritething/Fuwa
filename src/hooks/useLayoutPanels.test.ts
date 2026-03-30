import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLayoutPanels, COLUMN_MIN_WIDTHS } from './useLayoutPanels'

describe('useLayoutPanels', () => {
  it('exports column minimum widths', () => {
    expect(COLUMN_MIN_WIDTHS.sidebar).toBe(180)
    expect(COLUMN_MIN_WIDTHS.noteList).toBe(220)
    expect(COLUMN_MIN_WIDTHS.editor).toBe(800)
    expect(COLUMN_MIN_WIDTHS.inspector).toBe(240)
  })

  it('returns default widths', () => {
    const { result } = renderHook(() => useLayoutPanels())
    expect(result.current.sidebarWidth).toBe(250)
    expect(result.current.noteListWidth).toBe(300)
    expect(result.current.inspectorWidth).toBe(280)
  })

  it('clamps sidebar resize to minimum', () => {
    const { result } = renderHook(() => useLayoutPanels())
    act(() => result.current.handleSidebarResize(-500))
    expect(result.current.sidebarWidth).toBe(COLUMN_MIN_WIDTHS.sidebar)
  })

  it('clamps note list resize to minimum', () => {
    const { result } = renderHook(() => useLayoutPanels())
    act(() => result.current.handleNoteListResize(-500))
    expect(result.current.noteListWidth).toBe(COLUMN_MIN_WIDTHS.noteList)
  })

  it('clamps inspector resize to minimum', () => {
    const { result } = renderHook(() => useLayoutPanels())
    act(() => result.current.handleInspectorResize(500))
    expect(result.current.inspectorWidth).toBe(COLUMN_MIN_WIDTHS.inspector)
  })

  it('clamps sidebar resize to maximum', () => {
    const { result } = renderHook(() => useLayoutPanels())
    act(() => result.current.handleSidebarResize(500))
    expect(result.current.sidebarWidth).toBe(400)
  })

  it('clamps note list resize to maximum', () => {
    const { result } = renderHook(() => useLayoutPanels())
    act(() => result.current.handleNoteListResize(500))
    expect(result.current.noteListWidth).toBe(500)
  })

  it('clamps inspector resize to maximum', () => {
    const { result } = renderHook(() => useLayoutPanels())
    act(() => result.current.handleInspectorResize(-500))
    expect(result.current.inspectorWidth).toBe(500)
  })

  it('defaults inspector to collapsed', () => {
    const { result } = renderHook(() => useLayoutPanels())
    expect(result.current.inspectorCollapsed).toBe(true)
  })

  it('accepts initial inspector collapsed override', () => {
    const { result } = renderHook(() => useLayoutPanels({ initialInspectorCollapsed: false }))
    expect(result.current.inspectorCollapsed).toBe(false)
  })
})
