/**
 * AI Agent utilities — Claude CLI agent mode with scoped file tools + MCP vault tools.
 *
 * App-managed sessions can edit files in the active vault and use Tolaria-specific
 * MCP tools (search_notes, get_vault_context, get_note, open_note).
 * The frontend receives streaming events for text, tool calls, and completion.
 */

import { isTauri } from '../mock-tauri'

// --- Agent system prompt ---

const AGENT_SYSTEM_PREAMBLE = `You are working inside Tolaria, a personal knowledge management app.

Notes are markdown files with YAML frontmatter. Standard fields: title, type (aliased is_a), date, tags.
You can edit markdown files in the active vault. Prefer file edit tools for note changes.
Use the provided MCP tools for: full-text search (search_notes), vault orientation (get_vault_context), parsed note reading (get_note), and opening notes in the UI (open_note).
Avoid shell commands; app-managed sessions are intentionally scoped to vault file edits and Tolaria MCP tools.

When you create or edit a note, call open_note(path) so the user sees it in Tolaria.
When you mention or reference a note by name, always use [[Note Title]] wikilink syntax so the user can click to open it.
Be concise and helpful. When you've completed a task, briefly summarize what you did.`

export function buildAgentSystemPrompt(vaultContext?: string): string {
  if (!vaultContext) return AGENT_SYSTEM_PREAMBLE
  return `${AGENT_SYSTEM_PREAMBLE}\n\nVault context:\n${vaultContext}`
}

// --- Claude CLI agent streaming ---

type ClaudeAgentStreamEvent =
  | { kind: 'Init'; session_id: string }
  | { kind: 'TextDelta'; text: string }
  | { kind: 'ThinkingDelta'; text: string }
  | { kind: 'ToolStart'; tool_name: string; tool_id: string; input?: string }
  | { kind: 'ToolDone'; tool_id: string; output?: string }
  | { kind: 'Result'; text: string; session_id: string }
  | { kind: 'Error'; message: string }
  | { kind: 'Done' }

export interface AgentStreamCallbacks {
  onText: (text: string) => void
  onThinking: (text: string) => void
  onToolStart: (toolName: string, toolId: string, input?: string) => void
  onToolDone: (toolId: string, output?: string) => void
  onError: (message: string) => void
  onDone: () => void
}

/**
 * Generate a mock response for browser/test mode.
 * Inspects the message for conversation history so Playwright tests
 * can verify that history is actually being sent.
 */
function mockAgentResponse(message: string): string {
  if (message.includes('<conversation_history>')) {
    const allUserLines = message.match(/\[user\]: .+/g) ?? []
    const turnCount = allUserLines.length
    const lastLine = allUserLines[allUserLines.length - 1] ?? ''
    const lastUserMsg = lastLine.replace('[user]: ', '')
    return `[mock-with-history turns=${turnCount}] You asked: "${lastUserMsg}" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`
  }
  return `[mock-no-history] You said: "${message}" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`
}

function emitMockAgentResponse(message: string, callbacks: AgentStreamCallbacks): void {
  setTimeout(() => {
    callbacks.onText(mockAgentResponse(message))
    callbacks.onDone()
  }, 300)
}

function createStreamCloser(callbacks: AgentStreamCallbacks): () => void {
  let closed = false
  return () => {
    if (closed) return
    closed = true
    callbacks.onDone()
  }
}

function handleClaudeStreamEvent(
  data: ClaudeAgentStreamEvent,
  callbacks: AgentStreamCallbacks,
  closeStream: () => void,
): void {
  switch (data.kind) {
    case 'TextDelta':
      callbacks.onText(data.text)
      return
    case 'ThinkingDelta':
      callbacks.onThinking(data.text)
      return
    case 'ToolStart':
      callbacks.onToolStart(data.tool_name, data.tool_id, data.input)
      return
    case 'ToolDone':
      callbacks.onToolDone(data.tool_id, data.output)
      return
    case 'Error':
      callbacks.onError(data.message)
      return
    case 'Done':
      closeStream()
      return
    default:
      return
  }
}

/**
 * Stream an agent task through the Claude CLI subprocess with scoped tool access.
 * The CLI handles the tool-use loop; we receive events for UI updates.
 */
export async function streamClaudeAgent(
  message: string,
  systemPrompt: string | undefined,
  vaultPath: string,
  callbacks: AgentStreamCallbacks,
): Promise<void> {
  if (!isTauri()) {
    emitMockAgentResponse(message, callbacks)
    return
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const closeStream = createStreamCloser(callbacks)

  const unlisten = await listen<ClaudeAgentStreamEvent>('claude-agent-stream', (event) => {
    handleClaudeStreamEvent(event.payload, callbacks, closeStream)
  })

  try {
    await invoke<string>('stream_claude_agent', {
      request: {
        message,
        system_prompt: systemPrompt || null,
        vault_path: vaultPath,
      },
    })
    closeStream()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : String(err))
    closeStream()
  } finally {
    unlisten()
  }
}
