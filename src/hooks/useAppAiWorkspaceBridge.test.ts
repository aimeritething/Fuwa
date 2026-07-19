import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from '../lib/telemetry'
import { useAppAiWorkspaceBridge } from './useAppAiWorkspaceBridge'

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

function renderBridge(modelSelectorAvailable: boolean) {
  const openAIChat = vi.fn()
  const hook = renderHook(() => useAppAiWorkspaceBridge({
    aiFeaturesEnabled: true,
    aiWorkspaceWindow: false,
    closeAIChat: vi.fn(),
    modelSelectorAvailable,
    openAIChat,
    openSettings: vi.fn(),
    setSettingsInitialSectionId: vi.fn(),
    showAIChat: false,
  }))

  return { ...hook, openAIChat }
}

describe('useAppAiWorkspaceBridge', () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockReset()
  })

  it('includes model-selector availability in the workspace-open event', () => {
    const { result, openAIChat } = renderBridge(true)

    act(() => result.current.handleOpenDockedAiWorkspace())

    expect(trackEvent).toHaveBeenCalledWith('ai_workspace_open', {
      model_selector_available: 1,
      source: 'status_bar',
    })
    expect(openAIChat).toHaveBeenCalledOnce()
  })

  it('reports the surface as unavailable when no model-capable agent is installed', () => {
    const { result } = renderBridge(false)

    act(() => result.current.handleOpenDockedAiWorkspace())

    expect(trackEvent).toHaveBeenCalledWith('ai_workspace_open', {
      model_selector_available: 0,
      source: 'status_bar',
    })
  })
})
