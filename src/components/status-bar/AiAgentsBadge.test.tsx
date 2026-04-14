import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiAgentsBadge } from './AiAgentsBadge'

vi.mock('../../utils/url', async () => {
  const actual = await vi.importActual('../../utils/url')
  return { ...actual, openExternalUrl: vi.fn().mockResolvedValue(undefined) }
})

const installedStatuses = {
  claude_code: { status: 'installed' as const, version: '1.0.20' },
  codex: { status: 'installed' as const, version: '0.37.0' },
}

describe('AiAgentsBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the vault guidance summary and restore action', async () => {
    const onRestoreGuidance = vi.fn()

    render(
      <AiAgentsBadge
        statuses={installedStatuses}
        guidanceStatus={{
          agentsState: 'missing',
          claudeState: 'managed',
          canRestore: true,
        }}
        defaultAgent="claude_code"
        onSetDefaultAgent={vi.fn()}
        onRestoreGuidance={onRestoreGuidance}
      />,
    )

    act(() => {
      const trigger = screen.getByTestId('status-ai-agents')
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    })

    expect(screen.getByTestId('status-ai-guidance-summary')).toHaveTextContent('Tolaria guidance missing or broken')
    act(() => {
      fireEvent.click(screen.getByTestId('status-ai-guidance-restore'))
    })
    expect(onRestoreGuidance).toHaveBeenCalledOnce()
  })

  it('supports opening the menu and restoring guidance from the keyboard', () => {
    const onRestoreGuidance = vi.fn()

    render(
      <AiAgentsBadge
        statuses={installedStatuses}
        guidanceStatus={{
          agentsState: 'managed',
          claudeState: 'broken',
          canRestore: true,
        }}
        defaultAgent="claude_code"
        onSetDefaultAgent={vi.fn()}
        onRestoreGuidance={onRestoreGuidance}
      />,
    )

    act(() => {
      const trigger = screen.getByTestId('status-ai-agents')
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    })

    const restoreItem = screen.getByTestId('status-ai-guidance-restore')
    act(() => {
      restoreItem.focus()
      fireEvent.keyDown(restoreItem, { key: 'Enter' })
    })

    expect(onRestoreGuidance).toHaveBeenCalledOnce()
  })
})
