import assert from 'node:assert/strict'
import test from 'node:test'

import { detectVitestRetryMode, VITEST_RETRY_MODE } from './vitest-coverage-retry.mjs'

const passingSummary = `
Test Files  242 passed (242)
Tests  2750 passed (2750)
`

test('retries worker startup timeouts with one worker', () => {
  const output = `${passingSummary}
    [vitest-pool]: Failed to start forks worker
    [vitest-pool-runner]: Timeout waiting for worker to respond
  `

  assert.equal(detectVitestRetryMode(output), VITEST_RETRY_MODE.SINGLE_WORKER)
})

test('retries internal-state teardown flakes with the same settings', () => {
  const output = `${passingSummary}
    Vitest failed to access its internal state.
  `

  assert.equal(detectVitestRetryMode(output), VITEST_RETRY_MODE.SAME_SETTINGS)
})

test('does not retry assertion failures or incomplete runs', () => {
  assert.equal(detectVitestRetryMode(`${passingSummary}\nAssertionError: expected true`), null)
  assert.equal(
    detectVitestRetryMode('[vitest-pool]: Failed to start forks worker'),
    null,
  )
})
