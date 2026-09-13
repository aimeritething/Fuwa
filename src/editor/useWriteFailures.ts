import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Tab } from '@/types'

/**
 * Write failure: the only prompt in the app. A refused write
 * keeps the Tab open with an error bar offering Retry and Discard changes;
 * closing that Tab offers the same two instead of closing silently; ⌘Q writes
 * every pending edit first and, when one is refused, stays open with the same
 * choices plus Discard and quit. `useWriteFailureRecord` is the failure of
 * each Document; `useWriteFailures` adds the actions and the one prompt on
 * top of it. The save hook keeps the buffer, the Tabs hold the bytes.
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

export interface WriteFailureRecord {
  /** The Document's failure while its last write stands refused, else null. */
  failureFor: (path: string | null) => WriteFailure | null
  recordFailure: (path: string, error: unknown) => void
  /** A write landed (from any path): the bar goes away. */
  clearFailure: (path: string) => void
  /** The record as of now, for a decision made before React re-renders. */
  failuresRef: MutableRefObject<Readonly<Record<string, string>>>
}

export interface WriteFailureDeps {
  record: WriteFailureRecord
  tabs: Tab[]
  activeTabPath: string | null
  /** Push the active Document's fresh keystrokes into its buffer and write it; rejects when refused. */
  settleActiveNote: () => Promise<void>
  /** Write the Document's buffer again, `content` being the Tab's copy of it; rejects when refused. */
  writeBuffer: (path: string, content: string) => Promise<void>
  /** Drop the Document's buffered edits and put the disk bytes back in its Tab; rejects when the file is gone. */
  revertToDisk: (path: string) => Promise<void>
  closeTab: (path: string) => void
  exitApp: () => Promise<void>
}

export interface WriteFailures extends WriteFailureRecord {
  /** The deps' settle, with a refusal recorded against the active Document before it propagates. */
  settleAndRecord: () => Promise<void>
  /** The bar's Retry: true once the write lands. */
  retry: (path: string) => Promise<boolean>
  /** The bar's Discard changes: true once the disk bytes are back (or the Tab is closed, the file being gone). */
  discard: (path: string) => Promise<boolean>
  /** Close a Tab, or ask first when its last write stands refused. */
  closeTabOrAsk: (path: string) => void
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

/** State whose ref is updated in the same tick as the setter, for decisions made before React re-renders. */
function useStateWithRef<T>(initial: T): [T, MutableRefObject<T>, (next: T) => void] {
  const [value, setValue] = useState(initial)
  const ref = useRef(value)
  const set = useCallback((next: T) => {
    ref.current = next
    setValue(next)
  }, [])
  return [value, ref, set]
}

export function useWriteFailureRecord(): WriteFailureRecord {
  const [failures, failuresRef, setFailures] = useStateWithRef<Readonly<Record<string, string>>>({})

  const recordFailure = useCallback((path: string, error: unknown) => {
    console.error(`Could not save ${path}:`, error)
    setFailures({ ...failuresRef.current, [path]: messageOf(error) })
  }, [failuresRef, setFailures])

  const clearFailure = useCallback((path: string) => {
    if (!(path in failuresRef.current)) return
    const { [path]: _cleared, ...rest } = failuresRef.current
    void _cleared
    setFailures(rest)
  }, [failuresRef, setFailures])

  const failureFor = useCallback(
    (path: string | null): WriteFailure | null => {
      if (path === null) return null
      const message = failures[path]
      return message === undefined ? null : { path, message }
    },
    [failures],
  )

  return { failureFor, recordFailure, clearFailure, failuresRef }
}

export function useWriteFailures(deps: WriteFailureDeps): WriteFailures {
  const { record } = deps
  const { recordFailure, clearFailure, failuresRef } = record
  const depsRef = useRef(deps)
  useEffect(() => {
    depsRef.current = deps
  }, [deps])

  const [prompt, promptRef, showPrompt] = useStateWithRef<WritePrompt | null>(null)

  const settleAndRecord = useCallback(async () => {
    const { activeTabPath, settleActiveNote } = depsRef.current
    try {
      await settleActiveNote()
    } catch (error) {
      if (activeTabPath) recordFailure(activeTabPath, error)
      throw error
    }
  }, [recordFailure])

  /** Write the Document's buffer again; a Document that is no longer open has nothing left to write. */
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

  /**
   * Put the disk bytes back. A file that cannot be read any more has no bytes
   * to go back to: the Document is gone, so its Tab closes (the rule for a
   * Document deleted from outside).
   */
  const discard = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await depsRef.current.revertToDisk(path)
      } catch (error) {
        console.warn(`Closing ${path}: it could not be read back from disk:`, error)
        depsRef.current.closeTab(path)
      }
      clearFailure(path)
      return true
    },
    [clearFailure],
  )

  const closeTabOrAsk = useCallback(
    (path: string) => {
      const message = failuresRef.current[path]
      if (message === undefined) {
        depsRef.current.closeTab(path)
        return
      }
      showPrompt({ kind: 'close', path, message })
    },
    [failuresRef, showPrompt],
  )

  const exit = useCallback(async () => {
    showPrompt(null)
    try {
      await depsRef.current.exitApp()
    } catch (error) {
      console.error('Could not quit:', error)
    }
  }, [showPrompt])

  /** Write every refused Document again, in Tab order; ask about the first that is refused again, else exit. */
  const continueQuit = useCallback(async () => {
    for (const tab of depsRef.current.tabs) {
      const path = tab.entry.path
      if (!(path in failuresRef.current)) continue
      if (await retry(path)) continue
      showPrompt({ kind: 'quit', path, message: failuresRef.current[path] })
      return
    }
    await exit()
  }, [exit, failuresRef, retry, showPrompt])

  const quit = useCallback(async () => {
    try {
      await settleAndRecord()
    } catch {
      // Recorded against the active Document; the loop below asks about it.
    }
    await continueQuit()
  }, [continueQuit, settleAndRecord])

  const answerPrompt = useCallback(
    async (choice: WritePromptChoice) => {
      const current = promptRef.current
      if (!current) return
      if (choice === 'discardAndQuit') {
        await exit()
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
    [continueQuit, discard, exit, failuresRef, promptRef, retry, showPrompt],
  )

  const dismissPrompt = useCallback(() => showPrompt(null), [showPrompt])

  return {
    ...record,
    settleAndRecord,
    retry,
    discard,
    closeTabOrAsk,
    quit,
    prompt,
    answerPrompt,
    dismissPrompt,
  }
}
