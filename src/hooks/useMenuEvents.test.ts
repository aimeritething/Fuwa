import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_COMMAND_EVENT_NAME, resetAppCommandDispatchStateForTests } from './appCommandDispatcher'
import { dispatchMenuEvent, useMenuEvents, type MenuEventHandlers } from './useMenuEvents'

const runtime = vi.hoisted(() => ({
  inTauri: false,
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(() => Promise.resolve(null)),
  listeners: new Map<string, (event: { payload: string }) => void>(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => runtime.inTauri,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => runtime.invoke(cmd, args),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: async (name: string, handler: (event: { payload: string }) => void) => {
    runtime.listeners.set(name, handler)
    return () => { runtime.listeners.delete(name) }
  },
}))

function makeHandlers(overrides: Partial<MenuEventHandlers> = {}): MenuEventHandlers {
  return {
    activeDocumentPath: null,
    onCreateNote: vi.fn(),
    onOpenNote: vi.fn(),
    onQuickOpen: vi.fn(),
    onSave: vi.fn(),
    onPastePlainText: vi.fn(),
    onCommandPalette: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    ...overrides,
  }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useMenuEvents', () => {
  beforeEach(() => {
    runtime.inTauri = false
    runtime.invoke.mockClear()
    runtime.listeners.clear()
    resetAppCommandDispatchStateForTests()
  })

  afterEach(() => {
    delete window.__laputaTest
  })

  it('dispatches a native menu event id to its command handler', () => {
    const handlers = makeHandlers()

    dispatchMenuEvent('file-open-note', handlers)
    dispatchMenuEvent('file-save', handlers)
    dispatchMenuEvent('not-a-command', handlers)

    expect(handlers.onOpenNote).toHaveBeenCalledTimes(1)
    expect(handlers.onSave).toHaveBeenCalledTimes(1)
  })

  it('runs commands posted on the window as app events', () => {
    const handlers = makeHandlers()
    renderHook(() => useMenuEvents(handlers))

    act(() => {
      window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, { detail: 'file-save' }))
    })

    expect(handlers.onSave).toHaveBeenCalledTimes(1)
  })

  it('exposes the browser menu bridge for the smoke specs', () => {
    const handlers = makeHandlers()
    renderHook(() => useMenuEvents(handlers))

    act(() => {
      window.__laputaTest?.dispatchBrowserMenuCommand?.('file-open-note')
    })

    expect(handlers.onOpenNote).toHaveBeenCalledTimes(1)
  })

  it('outside Tauri it never talks to the native menu', () => {
    renderHook(() => useMenuEvents(makeHandlers({ activeDocumentPath: '/n/a.md' })))

    expect(runtime.invoke).not.toHaveBeenCalled()
  })

  describe('in Tauri', () => {
    beforeEach(() => {
      runtime.inTauri = true
    })

    it('listens for menu-event and dispatches its payload', async () => {
      const handlers = makeHandlers()
      renderHook(() => useMenuEvents(handlers))
      await flushMicrotasks()

      act(() => {
        runtime.listeners.get('menu-event')?.({ payload: 'file-save' })
      })

      expect(handlers.onSave).toHaveBeenCalledTimes(1)
    })

    it('the app menu\'s Quit item reaches onQuit, so the renderer flushes before the app exits (AIM-385)', async () => {
      const handlers = makeHandlers({ onQuit: vi.fn() })
      renderHook(() => useMenuEvents(handlers))
      await flushMicrotasks()

      act(() => {
        runtime.listeners.get('menu-event')?.({ payload: 'app-quit' })
      })

      expect(handlers.onQuit).toHaveBeenCalledTimes(1)
    })

    it('keeps the Document-dependent menu items in step with the active Document', async () => {
      const { rerender } = renderHook(
        ({ activeDocumentPath }: { activeDocumentPath: string | null }) => useMenuEvents(makeHandlers({ activeDocumentPath })),
        { initialProps: { activeDocumentPath: null } },
      )
      await flushMicrotasks()

      expect(runtime.invoke).toHaveBeenCalledWith('update_menu_state', { state: { hasActiveNote: false } })

      rerender({ activeDocumentPath: '/n/a.md' })
      await flushMicrotasks()

      expect(runtime.invoke).toHaveBeenLastCalledWith('update_menu_state', { state: { hasActiveNote: true } })
      expect(runtime.invoke).toHaveBeenCalledTimes(2)

      // Save, Toggle Rich/Raw and Find in Document go back to disabled over an
      // Image Tab, which the App reports by having no active Document.
      rerender({ activeDocumentPath: null })
      await flushMicrotasks()

      expect(runtime.invoke).toHaveBeenLastCalledWith('update_menu_state', { state: { hasActiveNote: false } })
    })
  })
})
