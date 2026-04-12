import { useEffect, useRef } from 'react'
import { isTauri } from '../mock-tauri'
import {
  APP_COMMAND_EVENT_NAME,
  executeAppCommand,
  isAppCommandId,
  type AppCommandHandlers,
} from './appCommandDispatcher'

export interface MenuEventHandlers extends AppCommandHandlers {
  activeTabPath: string | null
  modifiedCount?: number
  conflictCount?: number
  hasRestorableDeletedNote?: boolean
}

interface MenuStatePayload {
  hasActiveNote: boolean
  hasModifiedFiles?: boolean
  hasConflicts?: boolean
  hasRestorableDeletedNote?: boolean
}

function readCustomEventDetail(event: Event): string | null {
  if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') {
    return null
  }
  return event.detail
}

function createWindowCommandListener(
  dispatch: (id: string) => void,
): (event: Event) => void {
  return (event: Event) => {
    const detail = readCustomEventDetail(event)
    if (detail) {
      dispatch(detail)
    }
  }
}

function syncNativeMenuState(state: MenuStatePayload): void {
  if (!isTauri()) return

  import('@tauri-apps/api/core')
    .then(({ invoke }) => invoke('update_menu_state', { state }))
    .catch(() => {})
}

function useNativeMenuEventListener(handlersRef: { current: MenuEventHandlers }) {
  useEffect(() => {
    if (!isTauri()) return

    let disposed = false
    let unlisten: (() => void) | null = null

    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const teardown = await listen<string>('menu-event', (event) => {
          dispatchMenuEvent(event.payload, handlersRef.current)
        })

        if (disposed) {
          teardown()
          return
        }

        unlisten = teardown
      })
      .catch(() => {
        /* not in Tauri */
      })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [handlersRef])
}

function useWindowAppCommandListener(handlersRef: { current: MenuEventHandlers }) {
  useEffect(() => {
    const handleCommandEvent = createWindowCommandListener((detail) => {
      if (isAppCommandId(detail)) {
        executeAppCommand(detail, handlersRef.current, 'app-event')
      }
    })

    window.addEventListener(APP_COMMAND_EVENT_NAME, handleCommandEvent)
    return () => window.removeEventListener(APP_COMMAND_EVENT_NAME, handleCommandEvent)
  }, [handlersRef])
}

function useTestMenuCommandBridge(handlersRef: { current: MenuEventHandlers }) {
  useEffect(() => {
    const bridge = (id: string) => {
      dispatchMenuEvent(id, handlersRef.current)
    }

    window.__laputaTest = {
      ...window.__laputaTest,
      dispatchBrowserMenuCommand: bridge,
    }

    return () => {
      if (window.__laputaTest?.dispatchBrowserMenuCommand === bridge) {
        delete window.__laputaTest.dispatchBrowserMenuCommand
      }
    }
  }, [handlersRef])
}

function useNativeMenuStateSync(state: MenuStatePayload) {
  useEffect(() => {
    syncNativeMenuState(state)
  }, [state])
}

/** Dispatch a Tauri menu event ID to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, h: MenuEventHandlers): void {
  if (!isAppCommandId(id)) return
  executeAppCommand(id, h, 'native-menu')
}

/** Listen for native macOS menu events and dispatch them to the appropriate handlers. */
export function useMenuEvents(handlers: MenuEventHandlers) {
  const ref = useRef(handlers)
  const hasActiveNote = handlers.activeTabPath !== null
  const hasModifiedFiles = handlers.modifiedCount != null ? handlers.modifiedCount > 0 : undefined
  const hasConflicts = handlers.conflictCount != null ? handlers.conflictCount > 0 : undefined
  const hasRestorableDeletedNote = handlers.hasRestorableDeletedNote

  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useNativeMenuEventListener(ref)
  useWindowAppCommandListener(ref)
  useTestMenuCommandBridge(ref)
  useNativeMenuStateSync({
    hasActiveNote,
    hasModifiedFiles,
    hasConflicts,
    hasRestorableDeletedNote,
  })
}
