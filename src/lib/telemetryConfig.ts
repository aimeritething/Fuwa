const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

type TelemetryEnv = {
  VITE_SENTRY_DSN?: string
  VITE_POSTHOG_KEY?: string
  VITE_POSTHOG_HOST?: string
}

export type FrontendTelemetryConfig = {
  sentryDsn: string
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
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeSentryDsn(value: string): string {
  return isHttpUrl(value) ? value : ''
}

function normalizePostHogHost(value: string): string | null {
  if (!value) return DEFAULT_POSTHOG_HOST
  return isHttpUrl(value) ? value : null
}

export function resolveFrontendTelemetryConfig(
  env: TelemetryEnv = import.meta.env as TelemetryEnv,
): FrontendTelemetryConfig {
  const sentryDsn = normalizeSentryDsn(
    sanitizeTelemetryEnvValue(env.VITE_SENTRY_DSN),
  )
  const posthogKey = sanitizeTelemetryEnvValue(env.VITE_POSTHOG_KEY)
  const posthogHost = normalizePostHogHost(
    sanitizeTelemetryEnvValue(env.VITE_POSTHOG_HOST),
  )

  return { sentryDsn, posthogKey, posthogHost }
}

export { DEFAULT_POSTHOG_HOST as _defaultPostHogHostForTest }
