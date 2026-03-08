import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Capture what streamClaudeChat receives
const streamClaudeChatMock = vi.fn<
  Parameters<typeof import('../utils/ai-chat').streamClaudeChat>,
  ReturnType<typeof import('../utils/ai-chat').streamClaudeChat>
>()

vi.mock('../utils/ai-chat', async () => {
  const actual = await vi.importActual<typeof import('../utils/ai-chat')>('../utils/ai-chat')
  return {
    ...actual,
    streamClaudeChat: (...args: Parameters<typeof actual.streamClaudeChat>) => {
      streamClaudeChatMock(...args)
      // Simulate async: emit text, then done
      const callbacks = args[3]
      setTimeout(() => {
        callbacks.onText('mock response')
        callbacks.onDone()
      }, 10)
      return Promise.resolve('')
    },
  }
})

import { useAIChat } from './useAIChat'

beforeEach(() => {
  streamClaudeChatMock.mockClear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAIChat', () => {
  const emptyContent: Record<string, string> = {}

  it('sends first message as raw text without history', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    act(() => { result.current.sendMessage('hello') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(1)
    const [message, , sessionId] = streamClaudeChatMock.mock.calls[0]
    // First message: raw text, no history wrapping, no session_id
    expect(message).toBe('hello')
    expect(sessionId).toBeUndefined()
  })

  it('embeds conversation history in second message', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // First exchange
    act(() => { result.current.sendMessage('What is 2+2?') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Second message — should include history from first exchange
    act(() => { result.current.sendMessage('What is that times 3?') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(2)
    const [message] = streamClaudeChatMock.mock.calls[1]
    expect(message).toContain('<conversation_history>')
    expect(message).toContain('What is 2+2?')
    expect(message).toContain('mock response')
    expect(message).toContain('What is that times 3?')
  })

  it('accumulates history across multiple exchanges', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Exchange 1
    act(() => { result.current.sendMessage('Q1') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Exchange 2
    act(() => { result.current.sendMessage('Q2') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Exchange 3
    act(() => { result.current.sendMessage('Q3') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(3)

    // First call: no history
    expect(streamClaudeChatMock.mock.calls[0][0]).toBe('Q1')
    // Second call: history from first exchange
    const secondMsg = streamClaudeChatMock.mock.calls[1][0]
    expect(secondMsg).toContain('Q1')
    expect(secondMsg).toContain('Q2')
    // Third call: history from both exchanges
    const thirdMsg = streamClaudeChatMock.mock.calls[2][0]
    expect(thirdMsg).toContain('Q1')
    expect(thirdMsg).toContain('Q2')
    expect(thirdMsg).toContain('Q3')
  })

  it('never passes session_id (no --resume)', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    act(() => { result.current.sendMessage('Q1') })
    await act(async () => { vi.advanceTimersByTime(50) })
    act(() => { result.current.sendMessage('Q2') })

    // All calls should have undefined session_id
    for (const call of streamClaudeChatMock.mock.calls) {
      expect(call[2]).toBeUndefined()
    }
  })

  it('resets history after clearConversation', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Build up some history
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Clear
    act(() => { result.current.clearConversation() })
    expect(result.current.messages).toHaveLength(0)

    // Next message should have no history
    act(() => { result.current.sendMessage('fresh start') })

    const lastCall = streamClaudeChatMock.mock.calls[streamClaudeChatMock.mock.calls.length - 1]
    expect(lastCall[0]).toBe('fresh start') // raw text, no history wrapping
    expect(lastCall[2]).toBeUndefined()
  })

  it('includes system prompt on every message when context notes exist', async () => {
    const content = { 'note.md': 'Some note content' }
    const notes = [{ path: 'note.md', title: 'Test Note' }] as import('../types').VaultEntry[]

    const { result } = renderHook(() => useAIChat(content, notes))

    // First message
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Second message
    act(() => { result.current.sendMessage('follow up') })

    // Both calls should have system prompt
    const firstSystemPrompt = streamClaudeChatMock.mock.calls[0][1]
    expect(firstSystemPrompt).toBeTruthy()
    expect(firstSystemPrompt).toContain('Test Note')

    const secondSystemPrompt = streamClaudeChatMock.mock.calls[1][1]
    expect(secondSystemPrompt).toBeTruthy()
    expect(secondSystemPrompt).toContain('Test Note')
  })

  it('retries with correct history (excludes retried exchange)', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // First exchange
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })
    expect(result.current.messages).toHaveLength(2)

    // Retry the assistant response (index 1)
    act(() => { result.current.retryMessage(1) })

    const lastCall = streamClaudeChatMock.mock.calls[streamClaudeChatMock.mock.calls.length - 1]
    // Should re-send the user message with no history (retrying first exchange)
    expect(lastCall[0]).toBe('hello')
    expect(lastCall[2]).toBeUndefined()
  })
})
