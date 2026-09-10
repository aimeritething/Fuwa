import { useEffect, useMemo, useRef } from 'react'
import { isTauri } from '../mock-tauri'
import {
  APP_COMMAND_EVENT_NAME,
  executeAppCommand,
  isAppCommandId,
  type AppCommandHandlers,
} from './appCommandDispatcher'
import { cleanupTauriEventListener, type TauriUnlisten } from '../utils/tauriEventCleanup'

/**
 * Tolaria's native-menu bridge, trimmed to Fuwa's manifest: the Rust menu
 * emits `menu-event` with a command id, the renderer dispatches it, and the
 * renderer pushes the enable state of the manifest's state groups back with
 * `update_menu_state`. The window-event and `__laputaTest` paths let the
 * browser smoke specs drive the same handlers without a native menu.
 */

export interface MenuEventHandlers extends AppCommandHandlers {
  activeTabPath: string | null
}

interface MenuStatePayload {
  hasActiveNote: boolean
}

function readCustomEventDetail(event: Event): string | null {
  if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') {
    return null
  }
  return event.detail
}

function syncNativeMenuState(state: MenuStatePayload): void {
  if (!isTauri()) return

  import('@tauri-apps/api/core')
    .then(({ invoke }) => invoke('update_menu_state', { state }))
    .catch((err) => console.warn('[menu] Failed to sync native menu state:', err))
}

function useNativeMenuEventListener(handlersRef: { current: MenuEventHandlers }) {
  useEffect(() => {
    if (!isTauri()) return

    let disposed = false
    let unlisten: TauriUnlisten | null = null

    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const teardown = await listen<string>('menu-event', (event) => {
          dispatchMenuEvent(event.payload, handlersRef.current)
        })

        if (disposed) {
          cleanupTauriEventListener(teardown)
          return
        }

        unlisten = teardown
      })
      .catch((err) => {
        console.warn('[menu] Failed to subscribe to native menu events:', err)
      })

    return () => {
      disposed = true
      cleanupTauriEventListener(unlisten)
    }
  }, [handlersRef])
}

function useWindowAppCommandListener(handlersRef: { current: MenuEventHandlers }) {
  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = readCustomEventDetail(event)
      if (detail && isAppCommandId(detail)) {
        executeAppCommand(detail, handlersRef.current, 'app-event')
      }
    }

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

/** Dispatch a native menu event id to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, handlers: MenuEventHandlers): void {
  if (!isAppCommandId(id)) return
  executeAppCommand(id, handlers, 'native-menu')
}

/** Listen for native menu events and dispatch them to the app's command handlers. */
export function useMenuEvents(handlers: MenuEventHandlers) {
  const ref = useRef(handlers)
  const hasActiveNote = handlers.activeTabPath !== null
  const menuState = useMemo(() => ({ hasActiveNote }), [hasActiveNote])

  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useNativeMenuEventListener(ref)
  useWindowAppCommandListener(ref)
  useTestMenuCommandBridge(ref)
  useNativeMenuStateSync(menuState)
}
