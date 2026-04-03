import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTelemetry } from './useTelemetry'
import type { Settings } from '../types'

const mockInitSentry = vi.fn()
const mockTeardownSentry = vi.fn()
const mockInitPostHog = vi.fn()
const mockTeardownPostHog = vi.fn()

vi.mock('../lib/telemetry', () => ({
  initSentry: (...args: unknown[]) => mockInitSentry(...args),
  teardownSentry: () => mockTeardownSentry(),
  initPostHog: (...args: unknown[]) => mockInitPostHog(...args),
  teardownPostHog: () => mockTeardownPostHog(),
  updatePostHogIdentify: vi.fn(),
  setReleaseChannel: vi.fn(),
}))

const baseSettings: Settings = {
  openai_key: null, google_key: null,
  github_token: null, github_username: null, auto_pull_interval_minutes: null,
  telemetry_consent: null, crash_reporting_enabled: null,
  analytics_enabled: null, anonymous_id: null, update_channel: null, release_channel: null,
}

describe('useTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when settings are not loaded', () => {
    renderHook(() => useTelemetry(baseSettings, false))
    expect(mockInitSentry).not.toHaveBeenCalled()
    expect(mockInitPostHog).not.toHaveBeenCalled()
  })

  it('does nothing when consent is not granted', () => {
    renderHook(() => useTelemetry({ ...baseSettings, telemetry_consent: false }, true))
    expect(mockInitSentry).not.toHaveBeenCalled()
    expect(mockInitPostHog).not.toHaveBeenCalled()
  })

  it('initializes Sentry when crash reporting is enabled', () => {
    renderHook(() =>
      useTelemetry({ ...baseSettings, crash_reporting_enabled: true, anonymous_id: 'test-uuid' }, true)
    )
    expect(mockInitSentry).toHaveBeenCalledWith('test-uuid')
  })

  it('initializes PostHog when analytics is enabled', () => {
    renderHook(() =>
      useTelemetry({ ...baseSettings, analytics_enabled: true, anonymous_id: 'test-uuid' }, true)
    )
    expect(mockInitPostHog).toHaveBeenCalledWith('test-uuid', 'stable')
  })

  it('tears down Sentry when crash reporting is disabled after being enabled', () => {
    const settings1 = { ...baseSettings, crash_reporting_enabled: true, anonymous_id: 'test-uuid' }
    const { rerender } = renderHook(
      ({ settings, loaded }) => useTelemetry(settings, loaded),
      { initialProps: { settings: settings1, loaded: true } }
    )
    expect(mockInitSentry).toHaveBeenCalledOnce()

    const settings2 = { ...baseSettings, crash_reporting_enabled: false, anonymous_id: 'test-uuid' }
    rerender({ settings: settings2, loaded: true })
    expect(mockTeardownSentry).toHaveBeenCalledOnce()
  })

  it('does not initialize without anonymous_id', () => {
    renderHook(() =>
      useTelemetry({ ...baseSettings, crash_reporting_enabled: true, anonymous_id: null }, true)
    )
    expect(mockInitSentry).not.toHaveBeenCalled()
  })
})
