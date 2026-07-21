import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartupStateMilestones } from './useStartupStateMilestones'

const markStartupPhase = vi.hoisted(() => vi.fn())

vi.mock('../lib/startupPerformance', () => ({ markStartupPhase }))

describe('useStartupStateMilestones', () => {
  beforeEach(() => {
    markStartupPhase.mockReset()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('marks committed and painted app readiness only after startup data is ready', () => {
    const { rerender } = renderHook(
      (props) => useStartupStateMilestones(props),
      {
        initialProps: {
          isVaultContentLoading: true,
          onboardingStatus: 'loading',
          settingsLoaded: false,
          vaultListLoaded: false,
        },
      },
    )

    expect(markStartupPhase).not.toHaveBeenCalledWith('app_interactive')

    act(() => rerender({
      isVaultContentLoading: false,
      onboardingStatus: 'ready',
      settingsLoaded: true,
      vaultListLoaded: true,
    }))

    expect(markStartupPhase).toHaveBeenCalledWith('settings_loaded')
    expect(markStartupPhase).toHaveBeenCalledWith('vault_registry_loaded')
    expect(markStartupPhase).toHaveBeenCalledWith('onboarding_ready')
    expect(markStartupPhase).toHaveBeenCalledWith('app_interactive')
  })
})
