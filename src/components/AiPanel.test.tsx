import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiPanel } from './AiPanel'

// Mock the hooks and utils to isolate component tests
vi.mock('../hooks/useAiAgent', () => ({
  useAiAgent: () => ({
    messages: [],
    status: 'idle',
    sendMessage: vi.fn(),
    clearConversation: vi.fn(),
    canUndo: false,
    undoLastRun: vi.fn(),
  }),
}))

vi.mock('../utils/ai-agent', () => ({
  AGENT_MODEL_OPTIONS: [
    { value: 'claude-3-5-haiku-20241022', label: 'Haiku (fast)' },
    { value: 'claude-sonnet-4-20250514', label: 'Sonnet (smart)' },
  ],
  getAgentModel: () => 'claude-3-5-haiku-20241022',
  setAgentModel: vi.fn(),
}))

vi.mock('../utils/ai-chat', () => ({
  getApiKey: () => 'sk-test-key',
  nextMessageId: () => `msg-${Date.now()}`,
}))

describe('AiPanel', () => {
  it('renders panel with AI Agent header', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByText('AI Agent')).toBeTruthy()
  })

  it('renders data-testid ai-panel', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('ai-panel')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} />)
    const panel = screen.getByTestId('ai-panel')
    // Close button is the last button in the header
    const buttons = panel.querySelectorAll('button')
    const closeBtn = Array.from(buttons).find(b => b.title?.includes('Close'))
    expect(closeBtn).toBeTruthy()
    fireEvent.click(closeBtn!)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders empty state when no messages', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByText('Ask the AI agent to work with your vault')).toBeTruthy()
  })

  it('renders input field enabled', () => {
    render(<AiPanel onClose={vi.fn()} />)
    const input = screen.getByTestId('agent-input')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).disabled).toBe(false)
  })

  it('renders model selector', () => {
    render(<AiPanel onClose={vi.fn()} />)
    const select = screen.getByTestId('agent-model-select')
    expect(select).toBeTruthy()
    expect((select as HTMLSelectElement).value).toBe('claude-3-5-haiku-20241022')
  })

  it('has send button disabled when input is empty', () => {
    render(<AiPanel onClose={vi.fn()} />)
    const sendBtn = screen.getByTestId('agent-send')
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true)
  })
})
