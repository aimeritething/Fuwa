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
      // Simulate async: emit Init with session_id, then text, then done
      const callbacks = args[3]
      setTimeout(() => {
        callbacks.onInit?.('session-001')
        callbacks.onText('mock response')
        callbacks.onDone()
      }, 10)
      return Promise.resolve('session-001')
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

  it('sends first message without session_id (new session)', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    act(() => { result.current.sendMessage('hello') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(1)
    const [message, , sessionId] = streamClaudeChatMock.mock.calls[0]
    // First message: raw text, no session_id
    expect(message).toBe('hello')
    expect(sessionId).toBeUndefined()
  })

  it('resumes session on second message via --resume', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Send first message
    act(() => { result.current.sendMessage('What is Rust?') })
    // Wait for mock response (which fires onInit with session-001)
    await act(async () => { vi.advanceTimersByTime(50) })

    expect(result.current.messages).toHaveLength(2)

    // Send second message — should resume with session_id
    act(() => { result.current.sendMessage('Tell me more') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(2)
    const [message, systemPrompt, sessionId] = streamClaudeChatMock.mock.calls[1]
    // Raw message only (no embedded history)
    expect(message).toBe('Tell me more')
    // Session resumed via --resume
    expect(sessionId).toBe('session-001')
    // System prompt omitted on resumed sessions
    expect(systemPrompt).toBeUndefined()
  })

  it('resets session on clearConversation', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Send a message and get response
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Clear conversation
    act(() => { result.current.clearConversation() })
    expect(result.current.messages).toHaveLength(0)

    // Send new message — should start a fresh session (no session_id)
    act(() => { result.current.sendMessage('fresh start') })

    const lastCall = streamClaudeChatMock.mock.calls[streamClaudeChatMock.mock.calls.length - 1]
    expect(lastCall[0]).toBe('fresh start')
    expect(lastCall[2]).toBeUndefined() // no session_id
  })

  it('resumes session across multiple exchanges', async () => {
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

    // First call: no session
    expect(streamClaudeChatMock.mock.calls[0][2]).toBeUndefined()
    // Second and third calls: resume session
    expect(streamClaudeChatMock.mock.calls[1][2]).toBe('session-001')
    expect(streamClaudeChatMock.mock.calls[2][2]).toBe('session-001')

    // All messages are raw text (no embedded history)
    expect(streamClaudeChatMock.mock.calls[0][0]).toBe('Q1')
    expect(streamClaudeChatMock.mock.calls[1][0]).toBe('Q2')
    expect(streamClaudeChatMock.mock.calls[2][0]).toBe('Q3')
  })

  it('includes system prompt only on first message of a session', async () => {
    const content = { 'note.md': 'Some note content' }
    const notes = [{ path: 'note.md', title: 'Test Note' }] as import('../types').VaultEntry[]

    const { result } = renderHook(() => useAIChat(content, notes))

    // First message — system prompt included
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })

    const firstSystemPrompt = streamClaudeChatMock.mock.calls[0][1]
    expect(firstSystemPrompt).toBeTruthy()
    expect(firstSystemPrompt).toContain('Test Note')

    // Second message — system prompt omitted (session already has it)
    act(() => { result.current.sendMessage('follow up') })

    const secondSystemPrompt = streamClaudeChatMock.mock.calls[1][1]
    expect(secondSystemPrompt).toBeUndefined()
  })

  it('resets session on retry', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Send message and get response
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })
    expect(result.current.messages).toHaveLength(2)

    // Retry the assistant response (index 1)
    act(() => { result.current.retryMessage(1) })

    // Should start a fresh session
    const lastCall = streamClaudeChatMock.mock.calls[streamClaudeChatMock.mock.calls.length - 1]
    expect(lastCall[2]).toBeUndefined() // no session_id — fresh session
    expect(lastCall[0]).toBe('hello') // re-sends the user message
  })
})
