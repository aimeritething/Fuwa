import { useCallback } from 'react'
import type { EditorMode } from '../types'
import { trackEvent } from '../lib/telemetry'

interface UseRawModeParams {
  activeTabPath: string | null
  /** The active Tab's mode, or null with no Document open. */
  mode: EditorMode | null
  /** Puts a Document Tab in a mode; the Tab rules decide whether it takes. */
  setMode: (path: string, mode: EditorMode) => void
  /** Flush pending WYSIWYG edits to disk before entering raw mode. */
  onFlushPending?: () => Promise<boolean>
  /** Called synchronously before raw mode is deactivated, so the caller can
   *  flush any debounced raw-editor content into tab state. */
  onBeforeRawEnd?: () => void
}

/**
 * Manages raw editor mode state.
 * Fuwa (AIM-381): the mode is the active Tab's, not the vault's. Tolaria read
 * and wrote `editor_mode` in the vault config here; Fuwa reads the Tab and
 * hands the change back to the Tab state, which the Session file follows.
 * The flush-before-raw and before-raw-end sequence is unchanged.
 */
export function useRawMode({ activeTabPath, mode, setMode, onFlushPending, onBeforeRawEnd }: UseRawModeParams) {
  const rawMode = mode === 'raw' && activeTabPath !== null

  const handleToggleRaw = useCallback(async () => {
    if (activeTabPath === null) return
    trackEvent('raw_mode_toggled')
    if (rawMode) {
      onBeforeRawEnd?.()
      setMode(activeTabPath, 'rich')
    } else {
      await onFlushPending?.()
      setMode(activeTabPath, 'raw')
    }
  }, [activeTabPath, rawMode, setMode, onFlushPending, onBeforeRawEnd])

  return { rawMode, handleToggleRaw }
}
