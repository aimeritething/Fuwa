/**
 * Custom hook encapsulating AI chat state and message handling.
 * Uses Claude CLI subprocess via Tauri for streaming responses.
 *
 * Conversation continuity uses the CLI's --resume flag: the first message
 * starts a new session; subsequent messages resume it via session_id.
 * This avoids embedding history as text in the prompt (which the CLI's
 * -p mode treats as a single user turn, losing turn boundaries).
 */
import { useState, useCallback, useRef } from 'react'
import type { VaultEntry } from '../types'
import {
  type ChatMessage, type ChatStreamCallbacks, nextMessageId,
  buildSystemPrompt, streamClaudeChat,
} from '../utils/ai-chat'

interface ChatStreamRefs {
  abortRef: React.RefObject<boolean>
  sessionIdRef: React.MutableRefObject<string | undefined>
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setStreamingContent: React.Dispatch<React.SetStateAction<string>>
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
}

/** Create stream callbacks that accumulate text and update React state. */
function makeStreamCallbacks(
  refs: ChatStreamRefs,
): { callbacks: ChatStreamCallbacks; getAccumulated: () => string } {
  let accumulated = ''
  const callbacks: ChatStreamCallbacks = {
    onInit: (sid) => { refs.sessionIdRef.current = sid },
    onText: (chunk) => {
      if (refs.abortRef.current) return
      accumulated += chunk
      refs.setStreamingContent(accumulated)
    },
    onError: (error) => {
      if (refs.abortRef.current) return
      refs.setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}`, id: nextMessageId() }])
      refs.setStreamingContent('')
      refs.setIsStreaming(false)
    },
    onDone: () => {
      if (refs.abortRef.current) return
      if (accumulated) {
        refs.setMessages(prev => [...prev, { role: 'assistant', content: accumulated, id: nextMessageId() }])
      }
      refs.setStreamingContent('')
      refs.setIsStreaming(false)
    },
  }
  return { callbacks, getAccumulated: () => accumulated }
}

export function useAIChat(
  allContent: Record<string, string>,
  contextNotes: VaultEntry[],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef(false)
  const sessionIdRef = useRef<string | undefined>(undefined)

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return

    setMessages(prev => [...prev, { role: 'user', content: text.trim(), id: nextMessageId() }])
    setIsStreaming(true)
    setStreamingContent('')
    abortRef.current = false

    const currentSessionId = sessionIdRef.current
    // System prompt only on first message (new session).
    const systemPrompt = currentSessionId
      ? undefined
      : (buildSystemPrompt(contextNotes, allContent).prompt || undefined)

    const { callbacks } = makeStreamCallbacks({
      abortRef, sessionIdRef, setMessages, setStreamingContent, setIsStreaming,
    })

    streamClaudeChat(text.trim(), systemPrompt, currentSessionId, callbacks)
      .then((sid) => {
        if (sid && !sessionIdRef.current) sessionIdRef.current = sid
      })
      .catch(() => { /* errors forwarded via onError */ })
  }, [isStreaming, allContent, contextNotes])

  const clearConversation = useCallback(() => {
    abortRef.current = true
    setMessages([])
    setIsStreaming(false)
    setStreamingContent('')
    sessionIdRef.current = undefined
  }, [])

  const retryMessage = useCallback((msgIndex: number) => {
    const userMsgIndex = msgIndex - 1
    if (userMsgIndex < 0) return
    const userMsg = messages[userMsgIndex]
    if (userMsg.role !== 'user') return

    sessionIdRef.current = undefined
    setMessages(prev => prev.slice(0, msgIndex))
    sendMessage(userMsg.content)
  }, [messages, sendMessage])

  return { messages, isStreaming, streamingContent, sendMessage, clearConversation, retryMessage }
}
