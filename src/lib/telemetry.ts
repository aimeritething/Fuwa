import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN ?? ''
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? ''
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com'

/** Pattern that matches absolute file paths (macOS / Linux / Windows). */
const PATH_PATTERN = /(?:\/[\w.-]+){2,}|[A-Z]:\\[\w\\.-]+/g

function scrubPaths(input: string): string {
  return input.replace(PATH_PATTERN, '<redacted-path>')
}

let sentryInitialized = false
let posthogInstance: typeof import('posthog-js').default | null = null

export function initSentry(anonymousId: string): void {
  if (sentryInitialized || !SENTRY_DSN) return
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.message) event.message = scrubPaths(event.message)
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrubPaths(ex.value)
      }
      for (const bc of event.breadcrumbs ?? []) {
        if (bc.message) bc.message = scrubPaths(bc.message)
      }
      return event
    },
  })
  Sentry.setUser({ id: anonymousId })
  sentryInitialized = true
}

export function teardownSentry(): void {
  if (!sentryInitialized) return
  Sentry.close()
  sentryInitialized = false
}

export async function initPostHog(anonymousId: string, releaseChannel?: string): Promise<void> {
  if (posthogInstance || !POSTHOG_KEY) return
  const posthog = (await import('posthog-js')).default
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    persistence: 'memory',
    disable_session_recording: true,
  })
  posthog.identify(anonymousId, releaseChannel ? { release_channel: releaseChannel } : undefined)
  posthogInstance = posthog
}

export function teardownPostHog(): void {
  if (!posthogInstance) return
  posthogInstance.opt_out_capturing()
  posthogInstance.reset()
  posthogInstance = null
}

export function updatePostHogIdentify(releaseChannel: string): void {
  posthogInstance?.identify(undefined, { release_channel: releaseChannel })
}

/** Hardcoded defaults for first launch with no network (PostHog cache empty). */
const FEATURE_DEFAULTS: Record<string, boolean> = {}

let currentReleaseChannel: string = 'stable'

export function setReleaseChannel(channel: string): void {
  currentReleaseChannel = channel
}

export function isFeatureEnabled(flagKey: string): boolean {
  if (currentReleaseChannel === 'alpha') return true
  return posthogInstance?.isFeatureEnabled(flagKey) ?? FEATURE_DEFAULTS[flagKey] ?? false
}

export function trackEvent(name: string, properties?: Record<string, string | number>): void {
  posthogInstance?.capture(name, properties)
}

export { scrubPaths as _scrubPathsForTest }
