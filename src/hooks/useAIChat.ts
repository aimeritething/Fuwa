/**
 * Custom hook encapsulating AI chat state and message handling.
 * Uses Claude CLI subprocess via Tauri for streaming responses.
 */
import { useState, useCallback, useRef } from 'react'
import type { VaultEntry } from '../types'
import {
  type ChatMessage, nextMessageId,
  buildSystemPrompt, streamClaudeChat,
  trimHistory, formatMessageWithHistory, MAX_HISTORY_TOKENS,
} from '../utils/ai-chat'

export function useAIChat(
  allContent: Record<string, string>,
  contextNotes: VaultEntry[],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef(false)

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim(), id: nextMessageId() }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingContent('')
    abortRef.current = false

    const { prompt: systemPrompt } = buildSystemPrompt(contextNotes, allContent)
    const history = trimHistory(messages, MAX_HISTORY_TOKENS)
    const messageWithHistory = formatMessageWithHistory(history, text.trim())
    let accumulated = ''

    // No session_id: each call is independent. Context is provided via
    // formatted history in the prompt, avoiding --resume which causes
    // double-context confusion when combined with in-prompt history.
    streamClaudeChat(messageWithHistory, systemPrompt || undefined, undefined, {
      onText: (chunk) => {
        if (abortRef.current) return
        accumulated += chunk
        setStreamingContent(accumulated)
      },

      onError: (error) => {
        if (abortRef.current) return
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}`, id: nextMessageId() }])
        setStreamingContent('')
        setIsStreaming(false)
      },

      onDone: () => {
        if (abortRef.current) return
        if (accumulated) {
          setMessages(prev => [...prev, { role: 'assistant', content: accumulated, id: nextMessageId() }])
        }
        setStreamingContent('')
        setIsStreaming(false)
      },
    })
  }, [isStreaming, allContent, contextNotes, messages])

  const clearConversation = useCallback(() => {
    abortRef.current = true
    setMessages([])
    setIsStreaming(false)
    setStreamingContent('')
  }, [])

  const retryMessage = useCallback((msgIndex: number) => {
    const userMsgIndex = msgIndex - 1
    if (userMsgIndex < 0) return
    const userMsg = messages[userMsgIndex]
    if (userMsg.role !== 'user') return

    setMessages(prev => prev.slice(0, msgIndex))
    sendMessage(userMsg.content)
  }, [messages, sendMessage])

  return { messages, isStreaming, streamingContent, sendMessage, clearConversation, retryMessage }
}
