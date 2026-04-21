#!/usr/bin/env node

import { cp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const rootDir = process.cwd()
const finalCoverageDir = resolve(rootDir, 'coverage')
const coverageRunRoot = resolve(os.tmpdir(), 'tolaria-vitest-coverage-runs')
const runId = `${Date.now()}-${process.pid}`
const runCoverageDir = resolve(coverageRunRoot, runId)
const runCoverageTempDir = resolve(runCoverageDir, '.tmp')
const forwardedArgs = process.argv.slice(2)

await mkdir(runCoverageDir, { recursive: true })
// Vitest writes per-worker coverage shards under reportsDirectory/.tmp.
await mkdir(runCoverageTempDir, { recursive: true })

const packageManagerExec = process.env.npm_execpath
const command = packageManagerExec ? process.execPath : 'pnpm'
const commandArgs = packageManagerExec
  ? [packageManagerExec, 'exec', 'vitest', 'run', '--coverage', `--coverage.reportsDirectory=${runCoverageDir}`, ...forwardedArgs]
  : ['exec', 'vitest', 'run', '--coverage', `--coverage.reportsDirectory=${runCoverageDir}`, ...forwardedArgs]

const exitCode = await new Promise((resolveExit, rejectExit) => {
  const child = spawn(command, commandArgs, {
    cwd: rootDir,
    env: {
      ...process.env,
      VITEST_COVERAGE_DIR: runCoverageDir,
    },
    stdio: 'inherit',
  })

  child.on('error', rejectExit)
  child.on('exit', (code, signal) => {
    if (signal) {
      rejectExit(new Error(`Vitest coverage exited via signal: ${signal}`))
      return
    }

    resolveExit(code ?? 1)
  })
})

if (exitCode === 0) {
  await rm(finalCoverageDir, { recursive: true, force: true })
  await cp(runCoverageDir, finalCoverageDir, {
    force: true,
    recursive: true,
  })
  await rm(runCoverageDir, { recursive: true, force: true })
  process.exit(0)
}

console.error(`Vitest coverage artifacts preserved at ${runCoverageDir}`)
process.exit(exitCode)
