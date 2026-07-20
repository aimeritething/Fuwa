import { beforeEach, describe, expect, it, vi } from 'vitest'

const analytics = vi.hoisted(() => ({
  reconciled: vi.fn(),
  usable: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({ isTauri: () => false }))
vi.mock('./productAnalytics', () => ({
  trackStartupActiveVaultUsable: analytics.usable,
  trackStartupBackgroundReconciled: analytics.reconciled,
}))

describe('startup performance telemetry', () => {
  beforeEach(() => {
    analytics.reconciled.mockReset()
    analytics.usable.mockReset()
  })

  it('records the warm-start target and emits each milestone once', async () => {
    const startup = await import('./startupPerformance')

    startup.markStartupPhase('react_shell')
    startup.recordActiveVaultUsable('snapshot', 42)
    startup.recordActiveVaultUsable('scan', 7)
    startup.recordBackgroundReconciled(43)
    startup.recordBackgroundReconciled(44)
    await Promise.resolve()

    expect(startup.STARTUP_TARGETS_MS.activeVaultUsable).toBe(800)
    expect(analytics.usable).toHaveBeenCalledOnce()
    expect(analytics.usable).toHaveBeenCalledWith(expect.objectContaining({
      activeVaultEntryCount: 42,
      source: 'snapshot',
      targetMs: 800,
    }))
    expect(analytics.reconciled).toHaveBeenCalledOnce()
  })
})
