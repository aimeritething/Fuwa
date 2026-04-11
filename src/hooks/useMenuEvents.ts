import { useEffect, useRef } from 'react'
import { isTauri } from '../mock-tauri'
import {
  APP_COMMAND_EVENT_NAME,
  APP_MENU_EVENT_NAME,
  dispatchAppCommand,
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

/** Dispatch a Tauri menu event ID to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, h: MenuEventHandlers): void {
  if (!isAppCommandId(id)) return
  dispatchAppCommand(id, h)
}

/** Listen for native macOS menu events and dispatch them to the appropriate handlers. */
export function useMenuEvents(handlers: MenuEventHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers
  const hasActiveNote = handlers.activeTabPath !== null
  const hasModifiedFiles = handlers.modifiedCount != null ? handlers.modifiedCount > 0 : undefined
  const hasConflicts = handlers.conflictCount != null ? handlers.conflictCount > 0 : undefined
  const hasRestorableDeletedNote = handlers.hasRestorableDeletedNote

  // Subscribe once to Tauri menu events
  useEffect(() => {
    if (!isTauri()) return

    let cleanup: (() => void) | undefined
    import('@tauri-apps/api/event').then(({ listen }) => {
      const unlisten = listen<string>('menu-event', (event) => {
        dispatchMenuEvent(event.payload, ref.current)
      })
      cleanup = () => { unlisten.then(fn => fn()) }
    }).catch(() => { /* not in Tauri */ })

    return () => cleanup?.()
  }, [])

  useEffect(() => {
    const handleCommandEvent = createWindowCommandListener((detail) => {
      if (isAppCommandId(detail)) {
        dispatchAppCommand(detail, ref.current)
      }
    })

    window.addEventListener(APP_COMMAND_EVENT_NAME, handleCommandEvent)
    return () => window.removeEventListener(APP_COMMAND_EVENT_NAME, handleCommandEvent)
  }, [])

  useEffect(() => {
    const handleMenuCommandEvent = createWindowCommandListener((detail) => {
      dispatchMenuEvent(detail, ref.current)
    })

    window.addEventListener(APP_MENU_EVENT_NAME, handleMenuCommandEvent)
    return () => window.removeEventListener(APP_MENU_EVENT_NAME, handleMenuCommandEvent)
  }, [])

  // Sync menu item enabled state when active note or git state changes
  useEffect(() => {
    syncNativeMenuState({
      hasActiveNote,
      hasModifiedFiles,
      hasConflicts,
      hasRestorableDeletedNote,
    })
  }, [hasActiveNote, hasModifiedFiles, hasConflicts, hasRestorableDeletedNote])
}
