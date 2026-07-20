import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import {
  trackStartupActiveVaultUsable,
  trackStartupBackgroundReconciled,
} from './productAnalytics'

export const STARTUP_TARGETS_MS = {
  activeVaultUsable: 800,
  reactShell: 300,
} as const

type StartupSource = 'scan' | 'snapshot'
type StartupPhase = 'active_snapshot' | 'active_usable' | 'background_reconciled' | 'react_shell'

const frontendStartedAt = performance.now()
const phases = new Map<StartupPhase, number>()
let usableEventSent = false
let reconciliationEventSent = false

function elapsedSinceFrontendStart(): number {
  return Math.round(performance.now() - frontendStartedAt)
}

export function markStartupPhase(phase: StartupPhase): number {
  const existing = phases.get(phase)
  if (existing !== undefined) return existing
  const elapsed = elapsedSinceFrontendStart()
  phases.set(phase, elapsed)
  return elapsed
}

async function nativeStartupElapsedMs(): Promise<number | null> {
  if (!isTauri()) return null
  try {
    return await invoke<number>('get_startup_elapsed_ms')
  } catch {
    return null
  }
}

export function recordActiveVaultSnapshot(): void {
  markStartupPhase('active_snapshot')
}

export function recordActiveVaultUsable(source: StartupSource, entryCount: number): void {
  const activeVaultUsableMs = markStartupPhase('active_usable')
  if (usableEventSent) return
  usableEventSent = true
  void nativeStartupElapsedMs().then((nativeElapsedMs) => {
    trackStartupActiveVaultUsable({
      activeVaultEntryCount: entryCount,
      activeVaultUsableMs,
      nativeElapsedMs,
      reactShellMs: phases.get('react_shell') ?? null,
      source,
      targetMs: STARTUP_TARGETS_MS.activeVaultUsable,
    })
  })
}

export function recordBackgroundReconciled(entryCount: number): void {
  const elapsedMs = markStartupPhase('background_reconciled')
  if (reconciliationEventSent) return
  reconciliationEventSent = true
  trackStartupBackgroundReconciled({ elapsedMs, entryCount })
}
