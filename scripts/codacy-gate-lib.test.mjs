import assert from 'node:assert/strict'
import test from 'node:test'
import { addedLinesFromDiff, biomeGateFailures } from './codacy-gate-lib.mjs'
import { sarifGateFailures } from './codacy-sarif.mjs'

test('reports findings only on added lines', () => {
  const root = '/repo'
  const additions = addedLinesFromDiff([
    '+++ b/src/example.ts',
    '@@ -2,2 +2,3 @@',
    ' unchanged',
    '+new issue',
    ' existing issue',
  ].join('\n'), root)
  const sarif = { runs: [{
    tool: { driver: { name: 'Example' } },
    results: [3, 4].map((line) => ({
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/example.ts' }, region: { startLine: line } } }],
      message: { text: `line ${line}` },
      ruleId: 'rule',
    })),
  }] }

  assert.deepEqual(sarifGateFailures(sarif, additions, root).map((failure) => failure.line), [3])
})

test('fails closed when a scanner does not complete', () => {
  const failures = sarifGateFailures({ runs: [{
    invocations: [{ executionSuccessful: false }],
    tool: { driver: { name: 'Broken scanner' } },
  }] }, new Map())

  assert.equal(failures[0]?.message, 'Broken scanner did not complete successfully')
})

test('reports Biome diagnostics on added lines at every severity', () => {
  const additions = new Map([['/repo/src/example.ts', new Set([7])]])
  const report = { diagnostics: [{
    category: 'lint/style/example',
    location: { path: 'src/example.ts', start: { line: 7 } },
    message: 'minor issue',
    severity: 'info',
  }] }

  assert.equal(biomeGateFailures(report, additions, '/repo').length, 1)
})
