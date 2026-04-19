import { describe, expect, it } from 'vitest'
import {
  _defaultPostHogHostForTest as defaultPostHogHost,
  resolveFrontendTelemetryConfig,
  sanitizeTelemetryEnvValue,
} from './telemetryConfig'

describe('sanitizeTelemetryEnvValue', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeTelemetryEnvValue('  value  ')).toBe('value')
  })

  it('unwraps matching quotes after trimming', () => {
    expect(sanitizeTelemetryEnvValue('  "value"  ')).toBe('value')
    expect(sanitizeTelemetryEnvValue("  'value'  ")).toBe('value')
  })

  it('returns an empty string for blank input', () => {
    expect(sanitizeTelemetryEnvValue('   ')).toBe('')
    expect(sanitizeTelemetryEnvValue(undefined)).toBe('')
  })
})

describe('resolveFrontendTelemetryConfig', () => {
  it('keeps valid telemetry values after sanitizing them', () => {
    expect(resolveFrontendTelemetryConfig({
      VITE_SENTRY_DSN: ' "https://public@example.ingest.sentry.io/123456" ',
      VITE_POSTHOG_KEY: " 'phc_test_key' ",
      VITE_POSTHOG_HOST: ' https://eu.i.posthog.com ',
    })).toEqual({
      sentryDsn: 'https://public@example.ingest.sentry.io/123456',
      posthogKey: 'phc_test_key',
      posthogHost: 'https://eu.i.posthog.com',
    })
  })

  it('uses the default PostHog host when one is not configured', () => {
    expect(resolveFrontendTelemetryConfig({
      VITE_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123456',
      VITE_POSTHOG_KEY: 'phc_test_key',
    }).posthogHost).toBe(defaultPostHogHost)
  })

  it('drops invalid Sentry DSNs instead of passing them to the SDK', () => {
    expect(resolveFrontendTelemetryConfig({
      VITE_SENTRY_DSN: 'not a dsn',
      VITE_POSTHOG_KEY: 'phc_test_key',
      VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
    }).sentryDsn).toBe('')
  })

  it('drops invalid PostHog hosts instead of loading scripts from them', () => {
    expect(resolveFrontendTelemetryConfig({
      VITE_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123456',
      VITE_POSTHOG_KEY: 'phc_test_key',
      VITE_POSTHOG_HOST: 'not a url',
    }).posthogHost).toBeNull()
  })
})
