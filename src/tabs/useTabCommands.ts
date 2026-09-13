import { useMemo } from 'react'
import type { AppCommandHandlers } from '@/shell/appCommandDispatcher'

export interface TabCommandDeps {
  activeTabPath: string | null
  /** Push the rich editor's fresh keystrokes into the save buffer and write them. */
  settleActiveNote: () => Promise<void>
  closeTab: (path: string) => void
  activateTab: (path: string) => void
  activateTabAt: (index: number) => void
  activateAdjacentTab: (direction: 1 | -1) => void
  closeWindow: () => Promise<void>
}

/** The manifest commands this hook answers: ⌘W (close the active Tab; with zero Tabs, close the window), ⌘⇧[ / ⌘⇧], ⌘1–9. */
export type TabCommandHandlers = Required<
  Pick<AppCommandHandlers, 'onCloseTab' | 'onPreviousTab' | 'onNextTab' | (typeof JUMP_KEYS)[number]>
>

export interface TabCommands {
  handlers: TabCommandHandlers
  /** The tab bar's and Open Editors' click paths. */
  activateTabSettled: (path: string) => void
  closeTabSettled: (path: string) => void
}

const JUMP_KEYS = [
  'onJumpToTab1',
  'onJumpToTab2',
  'onJumpToTab3',
  'onJumpToTab4',
  'onJumpToTab5',
  'onJumpToTab6',
  'onJumpToTab7',
  'onJumpToTab8',
  'onJumpToTab9',
] as const

/**
 * The Tab commands behind ⌘W, ⌘⇧[ / ⌘⇧], ⌘1–9 and the two lists' clicks.
 * Every one of them first writes the active Document's pending edits (a
 * Document is flushed before it closes, and the save hook's scope follows
 * the active Tab), then moves. A refused write is the settle's to report
 * (the error bar) and does not hold the switch; `closeTab` is the guarded
 * close, which asks instead of closing such a Tab.
 */
export function useTabCommands(deps: TabCommandDeps): TabCommands {
  const { activeTabPath, settleActiveNote, closeTab, activateTab, activateTabAt, activateAdjacentTab, closeWindow } = deps

  return useMemo(() => {
    const afterSettling = (action: () => void) => {
      settleActiveNote()
        .catch(() => {
          // Recorded by the settle; the move goes ahead.
        })
        .then(action)
    }

    const handlers: TabCommandHandlers = {
      onCloseTab: () => {
        if (activeTabPath === null) {
          closeWindow().catch((error: unknown) => {
            console.error('Failed to close the window:', error)
          })
          return
        }
        afterSettling(() => closeTab(activeTabPath))
      },
      onPreviousTab: () => afterSettling(() => activateAdjacentTab(-1)),
      onNextTab: () => afterSettling(() => activateAdjacentTab(1)),
      ...(Object.fromEntries(
        JUMP_KEYS.map((key, index) => [key, () => afterSettling(() => activateTabAt(index))]),
      ) as Pick<TabCommandHandlers, (typeof JUMP_KEYS)[number]>),
    }
    return {
      handlers,
      activateTabSettled: (path) => afterSettling(() => activateTab(path)),
      closeTabSettled: (path) => afterSettling(() => closeTab(path)),
    }
  }, [activateAdjacentTab, activateTab, activateTabAt, activeTabPath, closeTab, closeWindow, settleActiveNote])
}
