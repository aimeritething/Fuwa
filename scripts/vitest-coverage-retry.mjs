export const VITEST_RETRY_MODE = {
  SAME_SETTINGS: 'same-settings',
  SINGLE_WORKER: 'single-worker',
}

function hasPassingTestSummary(output) {
  return /Test Files\s+\d+\s+passed\s+\(\d+\)/.test(output)
    && /Tests\s+\d+\s+passed\s+\(\d+\)/.test(output)
}

export function detectVitestRetryMode(output) {
  if (!hasPassingTestSummary(output)) {
    return null
  }

  if (output.includes('Vitest failed to access its internal state.')) {
    return VITEST_RETRY_MODE.SAME_SETTINGS
  }

  if (
    output.includes('[vitest-pool]: Failed to start forks worker')
    && output.includes('[vitest-pool-runner]: Timeout waiting for worker to respond')
  ) {
    return VITEST_RETRY_MODE.SINGLE_WORKER
  }

  return null
}
