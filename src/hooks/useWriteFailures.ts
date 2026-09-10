import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tab } from '../types'

/**
 * Write failure (spec section 5): the only prompt in the app. A refused write
 * keeps the Tab open with an error bar offering Retry and Discard changes;
 * closing that Tab offers the same two instead of closing silently; ⌘Q writes
 * every pending edit first and, when one is refused, stays open with the same
 * choices plus Discard and quit. This hook owns the failure of each Document
 * and the one prompt; the save hook keeps the buffer, the Tabs hold the bytes.
 */

export interface WriteFailure {
  path: string
  /** What the boundary said when it refused the write. */
  message: string
}

export interface WritePrompt {
  /** `close`: the user closed a Tab whose write was refused; `quit`: ⌘Q could not flush this Document. */
  kind: 'close' | 'quit'
  path: string
  message: string
}

export type WritePromptChoice = 'retry' | 'discard' | 'discardAndQuit'

export interface WriteFailureDeps {
  tabs: Tab[]
  activeTabPath: string | null
  /** Push the active Document's fresh keystrokes into the buffer and write it; rejects when refused. */
  settleActiveNote: () => Promise<void>
  /** Write `content` as the Document's buffer now; rejects when refused. */
  writeBuffer: (path: string, content: string) => Promise<void>
  /** Drop the Document's buffered edits and put the disk bytes back in its Tab. */
  revertToDisk: (path: string) => Promise<void>
  closeTab: (path: string) => void
  exitApp: () => Promise<void>
}

export interface WriteFailures {
  /** The Document's failure while its last write stands refused, else null. */
  failureFor: (path: string | null) => WriteFailure | null
  recordFailure: (path: string, error: unknown) => void
  /** A write landed (from any path): the bar goes away. */
  clearFailure: (path: string) => void
  /** The deps' settle, with a refusal recorded against the active Document before it propagates. */
  settleActiveNote: () => Promise<void>
  /** The bar's Retry: true once the write lands. */
  retry: (path: string) => Promise<boolean>
  /** The bar's Discard changes: true once the disk bytes are back. */
  discard: (path: string) => Promise<boolean>
  /** Close a Tab, or ask first when its last write was refused. */
  closeTab: (path: string) => void
  /** ⌘Q: write every pending edit, then exit; ask about the first refusal instead. */
  quit: () => Promise<void>
  prompt: WritePrompt | null
  answerPrompt: (choice: WritePromptChoice) => Promise<void>
  /** Escape: keep the Tab, or the app, open with its bar. */
  dismissPrompt: () => void
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useWriteFailures(deps: WriteFailureDeps): WriteFailures {
  const depsRef = useRef(deps)
  useEffect(() => {
    depsRef.current = deps
  }, [deps])

  // The ref is the source of truth so a decision made right after a refusal
  // (⌘W's close following its settle) sees it before React re-renders.
  const [failures, setFailures] = useState<Readonly<Record<string, string>>>({})
  const failuresRef = useRef(failures)
  const [prompt, setPrompt] = useState<WritePrompt | null>(null)
  const promptRef = useRef(prompt)

  const showPrompt = useCallback((next: WritePrompt | null) => {
    promptRef.current = next
    setPrompt(next)
  }, [])

  const recordFailure = useCallback((path: string, error: unknown) => {
    console.error(`Could not save ${path}:`, error)
    failuresRef.current = { ...failuresRef.current, [path]: messageOf(error) }
    setFailures(failuresRef.current)
  }, [])

  const clearFailure = useCallback((path: string) => {
    if (!(path in failuresRef.current)) return
    const { [path]: _cleared, ...rest } = failuresRef.current
    void _cleared
    failuresRef.current = rest
    setFailures(rest)
  }, [])

  const failureFor = useCallback(
    (path: string | null): WriteFailure | null => {
      if (path === null) return null
      const message = failures[path]
      return message === undefined ? null : { path, message }
    },
    [failures],
  )

  const settleActiveNote = useCallback(async () => {
    const { activeTabPath, settleActiveNote: settle } = depsRef.current
    try {
      await settle()
    } catch (error) {
      if (activeTabPath) recordFailure(activeTabPath, error)
      throw error
    }
  }, [recordFailure])

  /** Write the Tab's buffer again; a Document that is no longer open has nothing left to write. */
  const retry = useCallback(
    async (path: string): Promise<boolean> => {
      const tab = depsRef.current.tabs.find((candidate) => candidate.entry.path === path)
      if (!tab) {
        clearFailure(path)
        return true
      }
      try {
        await depsRef.current.writeBuffer(path, tab.content)
      } catch (error) {
        recordFailure(path, error)
        return false
      }
      clearFailure(path)
      return true
    },
    [clearFailure, recordFailure],
  )

  const discard = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await depsRef.current.revertToDisk(path)
      } catch (error) {
        console.error(`Could not reload ${path} from disk:`, error)
        return false
      }
      clearFailure(path)
      return true
    },
    [clearFailure],
  )

  const closeTab = useCallback(
    (path: string) => {
      const message = failuresRef.current[path]
      if (message === undefined) {
        depsRef.current.closeTab(path)
        return
      }
      showPrompt({ kind: 'close', path, message })
    },
    [showPrompt],
  )

  /** Write every refused Document again, in Tab order; ask about the first that is refused again, else exit. */
  const continueQuit = useCallback(async () => {
    for (const tab of depsRef.current.tabs) {
      const path = tab.entry.path
      if (!(path in failuresRef.current)) continue
      if (await retry(path)) continue
      showPrompt({ kind: 'quit', path, message: failuresRef.current[path] })
      return
    }
    showPrompt(null)
    await depsRef.current.exitApp()
  }, [retry, showPrompt])

  const quit = useCallback(async () => {
    try {
      await settleActiveNote()
    } catch {
      // Recorded against the active Document; the loop below asks about it.
    }
    await continueQuit()
  }, [continueQuit, settleActiveNote])

  const answerPrompt = useCallback(
    async (choice: WritePromptChoice) => {
      const current = promptRef.current
      if (!current) return
      if (choice === 'discardAndQuit') {
        showPrompt(null)
        await depsRef.current.exitApp()
        return
      }
      const resolved = choice === 'retry' ? await retry(current.path) : await discard(current.path)
      if (!resolved) {
        showPrompt({ ...current, message: failuresRef.current[current.path] ?? current.message })
        return
      }
      if (current.kind === 'close') {
        showPrompt(null)
        depsRef.current.closeTab(current.path)
        return
      }
      await continueQuit()
    },
    [continueQuit, discard, retry, showPrompt],
  )

  const dismissPrompt = useCallback(() => showPrompt(null), [showPrompt])

  return {
    failureFor,
    recordFailure,
    clearFailure,
    settleActiveNote,
    retry,
    discard,
    closeTab,
    quit,
    prompt,
    answerPrompt,
    dismissPrompt,
  }
}
