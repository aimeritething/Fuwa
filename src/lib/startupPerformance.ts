/**
 * Fuwa keeps the startup phase marks as a plain in-memory ledger: no Tauri
 * milestone command, no analytics. `waitForStartupPhase` still parks until the
 * phase is marked, which is what the lazy editor gate relies on.
 */

export type StartupPhase =
  | 'active_snapshot'
  | 'active_usable'
  | 'app_interactive'
  | 'app_module_loaded'
  | 'app_module_requested'
  | 'background_reconciled'
  | 'editor_committed'
  | 'editor_interactive'
  | 'editor_module_loaded'
  | 'editor_module_requested'
  | 'last_active_note_restore_started'
  | 'last_active_note_restored'
  | 'onboarding_ready'
  | 'react_shell'
  | 'renderer_module_loaded'
  | 'settings_loaded'
  | 'vault_load_started'
  | 'vault_registry_loaded'
  | 'vault_snapshot_received'

const phases = new Map<StartupPhase, number>()
const phaseWaiters = new Map<StartupPhase, Array<() => void>>()

export function markStartupPhase(phase: StartupPhase, detail: number | null = null): number {
  void detail
  const existing = phases.get(phase)
  if (existing !== undefined) return existing
  const elapsed = Math.round(performance.now())
  phases.set(phase, elapsed)
  const waiters = phaseWaiters.get(phase) ?? []
  phaseWaiters.delete(phase)
  for (const resolve of waiters) resolve()
  return elapsed
}

export function waitForStartupPhase(phase: StartupPhase): Promise<void> {
  if (phases.has(phase)) return Promise.resolve()
  return new Promise((resolve) => {
    const waiters = phaseWaiters.get(phase) ?? []
    waiters.push(resolve)
    phaseWaiters.set(phase, waiters)
  })
}
