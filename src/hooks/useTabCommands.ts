import { useMemo } from 'react'

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

export interface TabCommands {
  /** ⌘W: close the active Tab; with zero Tabs, close the window (spec section 7). */
  onCloseTab: () => void
  onPreviousTab: () => void
  onNextTab: () => void
  onJumpToTab1: () => void
  onJumpToTab2: () => void
  onJumpToTab3: () => void
  onJumpToTab4: () => void
  onJumpToTab5: () => void
  onJumpToTab6: () => void
  onJumpToTab7: () => void
  onJumpToTab8: () => void
  onJumpToTab9: () => void
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
 * Every one of them first writes the active Document's pending edits (spec
 * section 3 flushes a Document before it closes, and the save hook's scope
 * follows the active Tab), then moves. A failed write is logged and does not
 * hold the switch; the error bar is AIM-385.
 */
export function useTabCommands(deps: TabCommandDeps): TabCommands {
  const { activeTabPath, settleActiveNote, closeTab, activateTab, activateTabAt, activateAdjacentTab, closeWindow } = deps

  return useMemo(() => {
    const afterSettling = (action: () => void) => {
      settleActiveNote()
        .catch((error: unknown) => {
          console.error('Autosave failed:', error)
        })
        .then(action)
    }

    const commands: TabCommands = {
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
      activateTabSettled: (path) => afterSettling(() => activateTab(path)),
      closeTabSettled: (path) => afterSettling(() => closeTab(path)),
      ...(Object.fromEntries(
        JUMP_KEYS.map((key, index) => [key, () => afterSettling(() => activateTabAt(index))]),
      ) as Pick<TabCommands, (typeof JUMP_KEYS)[number]>),
    }
    return commands
  }, [activateAdjacentTab, activateTab, activateTabAt, activeTabPath, closeTab, closeWindow, settleActiveNote])
}
