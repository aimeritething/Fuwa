/**
 * Local feature flag hook (V1 — no remote fetching).
 *
 * Flags are resolved in order:
 *   1. localStorage override (`ff_<name>`) — for dev/QA testing
 *   2. Compile-time defaults in FLAG_DEFAULTS
 *
 * To add a new flag: add its name to the FeatureFlagName union and
 * set its default in FLAG_DEFAULTS.
 */

export type FeatureFlagName = 'example_flag'

const FLAG_DEFAULTS: Record<FeatureFlagName, boolean> = {
  example_flag: false,
}

export function useFeatureFlag(flag: FeatureFlagName): boolean {
  try {
    const override = localStorage.getItem(`ff_${flag}`)
    if (override !== null) return override === 'true'
  } catch {
    // localStorage may be unavailable in some contexts
  }
  return FLAG_DEFAULTS[flag] ?? false
}
