import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { initSentry, teardownSentry, initPostHog, teardownPostHog } from '../lib/telemetry'
import type { Settings } from '../types'

function tauriCall(command: string): Promise<void> {
  return isTauri() ? invoke<void>(command) : mockInvoke<void>(command)
}

/**
 * Initializes / tears down Sentry and PostHog reactively based on user settings.
 * Call once in App after settings are loaded.
 */
export function useTelemetry(settings: Settings, loaded: boolean): void {
  const prevCrash = useRef(false)
  const prevAnalytics = useRef(false)

  useEffect(() => {
    if (!loaded) return
    const crashEnabled = settings.crash_reporting_enabled === true
    const analyticsEnabled = settings.analytics_enabled === true
    const id = settings.anonymous_id

    if (crashEnabled && id && !prevCrash.current) {
      initSentry(id)
    } else if (!crashEnabled && prevCrash.current) {
      teardownSentry()
      tauriCall('reinit_telemetry').catch(() => {})
    }

    if (analyticsEnabled && id && !prevAnalytics.current) {
      initPostHog(id)
    } else if (!analyticsEnabled && prevAnalytics.current) {
      teardownPostHog()
    }

    prevCrash.current = crashEnabled
    prevAnalytics.current = analyticsEnabled
  }, [loaded, settings.crash_reporting_enabled, settings.analytics_enabled, settings.anonymous_id])
}
