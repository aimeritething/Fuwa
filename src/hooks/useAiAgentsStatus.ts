import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import {
  createCheckingAiAgentsStatus,
  createMissingAiAgentsStatus,
  normalizeAiAgentsStatus,
  type AiAgentId,
  type AiAgentsStatus,
} from '../lib/aiAgents'

type RawAiAgentsStatus = Partial<Record<AiAgentId, { installed?: boolean | null; version?: string | null }>>

interface UseAiAgentsStatusOptions {
  /**
   * When false, the hook stays in its initial state and never calls the
   * Tauri probe. Used to skip the ~1 s discovery cost when AI features are
   * disabled or when running in a detached note window where the result is
   * never rendered.
   *
   * Defaults to true to preserve existing behaviour for callers that pass
   * no options.
   */
  enabled?: boolean
}

type IdleHandle = number

function tauriCall<T>(command: string): Promise<T> {
  return isTauri() ? invoke<T>(command) : mockInvoke<T>(command)
}

function scheduleIdle(callback: () => void): IdleHandle {
  const requestIdle = (typeof window !== 'undefined' ? window.requestIdleCallback : undefined)
  if (typeof requestIdle === 'function') {
    return requestIdle(callback) as IdleHandle
  }
  return setTimeout(callback, 0) as unknown as IdleHandle
}

function cancelIdle(handle: IdleHandle): void {
  const cancelIdleFn = (typeof window !== 'undefined' ? window.cancelIdleCallback : undefined)
  if (typeof cancelIdleFn === 'function') {
    cancelIdleFn(handle)
  }
  // Always also clearTimeout — in environments without requestIdleCallback the
  // handle was created by setTimeout, and clearTimeout silently no-ops on
  // unknown handles, so it is safe to call unconditionally.
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

export function useAiAgentsStatus(options?: UseAiAgentsStatusOptions): AiAgentsStatus {
  const enabled = options?.enabled ?? true
  const [statuses, setStatuses] = useState<AiAgentsStatus>(createCheckingAiAgentsStatus())

  useEffect(() => {
    if (!enabled) {
      // Skip the probe entirely. Status is intentionally NOT reset — last-known
      // results stay in memory across enabled/disabled toggles so that a brief
      // disable does not blank out the badge.
      return
    }

    let cancelled = false

    const fire = () => {
      if (cancelled) return

      tauriCall<RawAiAgentsStatus>('get_ai_agents_status')
        .then((result) => {
          if (!cancelled) {
            setStatuses(normalizeAiAgentsStatus(result))
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatuses(createMissingAiAgentsStatus())
          }
        })
    }

    // Defer the probe so it does not run on the cold-start critical path.
    // requestIdleCallback is unavailable in WKWebView (Tauri's macOS web view),
    // so fall back to setTimeout(0).
    const handle = scheduleIdle(fire)

    return () => {
      cancelled = true
      cancelIdle(handle)
    }
  }, [enabled])

  return statuses
}
