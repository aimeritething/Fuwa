import { useCallback, useState } from 'react'
import type { CommandMenuMode } from '../utils/commandMenuMatcher'

export interface CommandMenuOpenState {
  open: boolean
  mode: CommandMenuMode
}

export interface CommandMenuController extends CommandMenuOpenState {
  /** ⌘K: open the Command Menu, or close it when it is already showing commands. */
  openCommands: () => void
  /** ⌘P: open Quick Open, or close it when it is already showing files only. */
  openFiles: () => void
  close: () => void
}

const CLOSED: CommandMenuOpenState = { open: false, mode: 'commands' }

function toggled(state: CommandMenuOpenState, mode: CommandMenuMode): CommandMenuOpenState {
  if (state.open && state.mode === mode) return { open: false, mode }
  return { open: true, mode }
}

/**
 * Whether the palette is showing and in which of its two modes (spec section
 * 7). The same chord pressed again closes it; the other chord switches the
 * mode in place, so ⌘K over Quick Open widens the list to commands and ⌘P
 * over the Command Menu narrows it to files.
 */
export function useCommandMenu(): CommandMenuController {
  const [state, setState] = useState<CommandMenuOpenState>(CLOSED)
  const openCommands = useCallback(() => setState((prev) => toggled(prev, 'commands')), [])
  const openFiles = useCallback(() => setState((prev) => toggled(prev, 'files')), [])
  const close = useCallback(() => setState((prev) => (prev.open ? { ...prev, open: false } : prev)), [])
  return { ...state, openCommands, openFiles, close }
}
