const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
const DISALLOWED_TELEMETRY_VALUES = new Set([
  'false',
  'true',
  'null',
  'undefined',
  'none',
  'disabled',
])

type TelemetryEnv = {
  VITE_SENTRY_DSN?: string
  VITE_SENTRY_RELEASE?: string
  VITE_POSTHOG_KEY?: string
  VITE_POSTHOG_HOST?: string
}

export type FrontendTelemetryConfig = {
  sentryDsn: string
  sentryRelease: string
  posthogKey: string
  posthogHost: string | null
}

function unwrapMatchingQuotes(value: string): string {
  if (value.length < 2) return value

  const first = value[0]
  const last = value[value.length - 1]
  if (first !== last) return value
  if (first !== '"' && first !== "'") return value

  return value.slice(1, -1).trim()
}

export function sanitizeTelemetryEnvValue(value: string | undefined): string {
  if (!value) return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  return unwrapMatchingQuotes(trimmed)
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && isAllowedTelemetryHostname(url.hostname)
  } catch {
    return false
  }
}

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().replace(/\.$/, '').toLowerCase()
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1)
  }
  return normalized
}

function isIpAddress(hostname: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return hostname.split('.').every((segment) => Number(segment) <= 255)
  }

  return hostname.includes(':') && /^[\da-f:]+$/i.test(hostname)
}

function isAllowedTelemetryHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  if (!normalized || DISALLOWED_TELEMETRY_VALUES.has(normalized)) return false
  if (normalized === 'localhost') return true
  return normalized.includes('.') || isIpAddress(normalized)
}

function normalizeHttpLikeValue(value: string): string {
  if (!value) return ''
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) return value
  return `https://${value}`
}

function normalizeSentryDsn(value: string): string {
  const normalized = normalizeHttpLikeValue(value)
  return isHttpUrl(normalized) ? normalized : ''
}

function normalizeSentryRelease(value: string): string {
  if (!value) return ''
  return DISALLOWED_TELEMETRY_VALUES.has(value.toLowerCase()) ? '' : value
}

function normalizePostHogHost(value: string): string | null {
  if (!value) return DEFAULT_POSTHOG_HOST
  const normalized = normalizeHttpLikeValue(value)
  return isHttpUrl(normalized) ? normalized : null
}

export function resolveFrontendTelemetryConfig(
  env: TelemetryEnv = import.meta.env as TelemetryEnv,
): FrontendTelemetryConfig {
  const sentryDsn = normalizeSentryDsn(
    sanitizeTelemetryEnvValue(env.VITE_SENTRY_DSN),
  )
  const sentryRelease = normalizeSentryRelease(
    sanitizeTelemetryEnvValue(env.VITE_SENTRY_RELEASE),
  )
  const posthogKey = sanitizeTelemetryEnvValue(env.VITE_POSTHOG_KEY)
  const posthogHost = normalizePostHogHost(
    sanitizeTelemetryEnvValue(env.VITE_POSTHOG_HOST),
  )

  return { sentryDsn, sentryRelease, posthogKey, posthogHost }
}

export { DEFAULT_POSTHOG_HOST as _defaultPostHogHostForTest }
