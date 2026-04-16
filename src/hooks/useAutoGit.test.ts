import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoGit } from './useAutoGit'

describe('useAutoGit', () => {
  let hasFocus = true

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hasFocus').mockImplementation(() => hasFocus)
    hasFocus = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('triggers an idle checkpoint after the configured threshold', async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(true)
    renderHook(() => useAutoGit({
      enabled: true,
      idleThresholdSeconds: 3,
      inactiveThresholdSeconds: 2,
      isGitVault: true,
      hasPendingChanges: true,
      hasUnsavedChanges: false,
      onCheckpoint,
    }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_999)
    })
    expect(onCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(onCheckpoint).toHaveBeenCalledWith('idle')
  })

  it('waits for the app to become inactive before triggering the inactive checkpoint', async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(true)
    renderHook(() => useAutoGit({
      enabled: true,
      idleThresholdSeconds: 10,
      inactiveThresholdSeconds: 2,
      isGitVault: true,
      hasPendingChanges: true,
      hasUnsavedChanges: false,
      onCheckpoint,
    }))

    hasFocus = false
    await act(async () => {
      window.dispatchEvent(new Event('blur'))
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(onCheckpoint).toHaveBeenCalledWith('inactive')
  })

  it('does not trigger while the editor still has unsaved changes', async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(true)
    renderHook(() => useAutoGit({
      enabled: true,
      idleThresholdSeconds: 1,
      inactiveThresholdSeconds: 1,
      isGitVault: true,
      hasPendingChanges: true,
      hasUnsavedChanges: true,
      onCheckpoint,
    }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(onCheckpoint).not.toHaveBeenCalled()
  })

  it('only triggers once per activity burst until activity is recorded again', async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() => useAutoGit({
      enabled: true,
      idleThresholdSeconds: 1,
      inactiveThresholdSeconds: 1,
      isGitVault: true,
      hasPendingChanges: true,
      hasUnsavedChanges: false,
      onCheckpoint,
    }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(onCheckpoint).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(onCheckpoint).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.recordActivity()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(onCheckpoint).toHaveBeenCalledTimes(2)
  })
})
