/**
 * Hook for the AI agent panel — manages agent state, tool execution, and undo.
 *
 * States: idle → thinking → tool-executing → response
 */
import { useState, useCallback, useRef } from 'react'
import type { AiAction } from '../components/AiMessage'
import {
  runAgentLoop, buildAgentSystemPrompt, executeToolViaWs,
  getAgentModel, type AgentStepCallback,
} from '../utils/ai-agent'
import { getApiKey, nextMessageId } from '../utils/ai-chat'

export type AgentStatus = 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'

export interface AiAgentMessage {
  userMessage: string
  reasoning?: string
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  id?: string
}

interface UndoSnapshot {
  contents: Map<string, string>
}

export function useAiAgent() {
  const [messages, setMessages] = useState<AiAgentMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const abortRef = useRef({ aborted: false })
  const undoRef = useRef<UndoSnapshot | null>(null)
  const [canUndo, setCanUndo] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || status === 'thinking' || status === 'tool-executing') return

    const apiKey = getApiKey()
    if (!apiKey) {
      setMessages(prev => [...prev, {
        userMessage: text.trim(),
        actions: [],
        response: 'No API key configured. Open Settings (\u2318,) to add your Anthropic key.',
        id: nextMessageId(),
      }])
      return
    }

    abortRef.current = { aborted: false }
    undoRef.current = null
    setCanUndo(false)

    const messageId = nextMessageId()
    const newMessage: AiAgentMessage = {
      userMessage: text.trim(),
      actions: [],
      isStreaming: true,
      id: messageId,
    }

    setMessages(prev => [...prev, newMessage])
    setStatus('thinking')

    const touchedPaths = new Set<string>()

    const updateCurrentMessage = (updater: (msg: AiAgentMessage) => AiAgentMessage) => {
      setMessages(prev => prev.map(m => m.id === messageId ? updater(m) : m))
    }

    const callbacks: AgentStepCallback = {
      onThinking: () => setStatus('thinking'),

      onToolStart: (toolName, toolId) => {
        setStatus('tool-executing')
        if (isWriteTool(toolName)) touchedPaths.add(toolName)
        updateCurrentMessage(msg => ({
          ...msg,
          actions: [...msg.actions, {
            tool: toolName,
            label: formatToolLabel(toolName, toolId),
            status: 'pending' as const,
          }],
        }))
      },

      onToolDone: (toolId, result, isError) => {
        updateCurrentMessage(msg => ({
          ...msg,
          actions: msg.actions.map(a =>
            a.label.includes(toolId.slice(-6))
              ? { ...a, status: (isError ? 'error' : 'done') as const, label: formatToolResult(a.tool, result) }
              : a,
          ),
        }))
      },

      onText: (text) => {
        updateCurrentMessage(msg => ({ ...msg, response: (msg.response ?? '') + text }))
      },

      onError: (error) => {
        setStatus('error')
        updateCurrentMessage(msg => ({ ...msg, isStreaming: false, response: `Error: ${error}` }))
      },

      onDone: () => {
        setStatus('done')
        updateCurrentMessage(msg => ({ ...msg, isStreaming: false }))
      },
    }

    const model = getAgentModel()
    const systemPrompt = buildAgentSystemPrompt()
    await runAgentLoop(text.trim(), model, systemPrompt, callbacks, abortRef.current)

    if (touchedPaths.size > 0) setCanUndo(true)
  }, [status])

  const clearConversation = useCallback(() => {
    abortRef.current.aborted = true
    setMessages([])
    setStatus('idle')
    setCanUndo(false)
    undoRef.current = null
  }, [])

  const undoLastRun = useCallback(async () => {
    if (!undoRef.current) return
    const snapshot = undoRef.current
    undoRef.current = null
    setCanUndo(false)
    // Restore each file to its pre-run content via WS bridge
    for (const [path, originalContent] of snapshot.contents) {
      await executeToolViaWs('save_note_content', { path, content: originalContent })
        .catch(() => {/* best effort — tool may not exist */})
    }
  }, [])

  return { messages, status, sendMessage, clearConversation, canUndo, undoLastRun }
}

// --- Helpers ---

function isWriteTool(name: string): boolean {
  return ['create_note', 'append_to_note', 'edit_note_frontmatter', 'delete_note', 'link_notes'].includes(name)
}

function formatToolLabel(toolName: string, toolId: string): string {
  const suffix = toolId.slice(-6)
  const labels: Record<string, string> = {
    read_note: 'Reading note',
    create_note: 'Creating note',
    search_notes: 'Searching notes',
    append_to_note: 'Appending to note',
    edit_note_frontmatter: 'Editing frontmatter',
    delete_note: 'Deleting note',
    link_notes: 'Linking notes',
    list_notes: 'Listing notes',
    vault_context: 'Loading vault context',
    ui_open_note: 'Opening note',
    ui_open_tab: 'Opening tab',
    ui_highlight: 'Highlighting',
    ui_set_filter: 'Setting filter',
  }
  return `${labels[toolName] ?? toolName}... (${suffix})`
}

function formatToolResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return toolName
  const r = result as Record<string, unknown>
  if (r.error) return `${toolName}: Error \u2014 ${r.error}`
  if (r.content && typeof r.content === 'string') return `Read: ${(r.content as string).slice(0, 40)}...`
  if (r.ok) return `${humanToolName(toolName)}: Done`
  if (Array.isArray(result)) return `Found ${result.length} results`
  return humanToolName(toolName)
}

function humanToolName(toolName: string): string {
  const names: Record<string, string> = {
    read_note: 'Read note',
    create_note: 'Created note',
    search_notes: 'Searched notes',
    append_to_note: 'Appended to note',
    edit_note_frontmatter: 'Edited frontmatter',
    delete_note: 'Deleted note',
    link_notes: 'Linked notes',
    list_notes: 'Listed notes',
    vault_context: 'Loaded vault context',
    ui_open_note: 'Opened note',
    ui_open_tab: 'Opened tab',
    ui_highlight: 'Highlighted',
    ui_set_filter: 'Set filter',
  }
  return names[toolName] ?? toolName
}
