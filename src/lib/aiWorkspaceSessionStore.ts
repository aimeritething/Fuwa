import type { Dispatch, SetStateAction } from 'react'
import type { AgentStatus, AiAgentMessage } from './aiAgentConversation'

const STORAGE_KEY = 'tolaria:ai-workspace-sessions:v1'
const BROADCAST_CHANNEL = 'tolaria-ai-workspace-sessions'

export interface AiWorkspaceSessionSnapshot {
  messages: AiAgentMessage[]
  status: AgentStatus
}

type SessionMap = Record<string, AiWorkspaceSessionSnapshot>
type Listener = () => void

const EMPTY_SESSION: AiWorkspaceSessionSnapshot = {
  messages: [],
  status: 'idle',
}

let sessions: SessionMap = readStoredSessions()
let broadcastChannel: BroadcastChannel | null = null
const listeners = new Set<Listener>()

function isSessionSnapshot(value: unknown): value is AiWorkspaceSessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AiWorkspaceSessionSnapshot>
  return Array.isArray(candidate.messages) && typeof candidate.status === 'string'
}

function readStoredSessions(): SessionMap {
  if (typeof localStorage === 'undefined') return {}

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AiWorkspaceSessionSnapshot] => (
        typeof entry[0] === 'string' && isSessionSnapshot(entry[1])
      )),
    )
  } catch {
    return {}
  }
}

function writeStoredSessions(): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Session history is a convenience cache; streaming state still lives in memory.
  }
}

function notifyListeners(): void {
  for (const listener of listeners) listener()
}

function broadcastSessions(): void {
  if (typeof BroadcastChannel === 'undefined') return

  broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL)
  broadcastChannel.postMessage({ type: 'ai-workspace-sessions-updated' })
}

function publishSessions(): void {
  writeStoredSessions()
  broadcastSessions()
  notifyListeners()
}

function replaceSessions(nextSessions: SessionMap): void {
  sessions = nextSessions
  notifyListeners()
}

function syncFromStorage(): void {
  replaceSessions(readStoredSessions())
}

function ensureCrossWindowSync(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) syncFromStorage()
  })

  if (typeof BroadcastChannel === 'undefined') return
  broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL)
  broadcastChannel.onmessage = syncFromStorage
}

ensureCrossWindowSync()

export function aiWorkspaceSessionSnapshot(sessionId: string): AiWorkspaceSessionSnapshot {
  return sessions[sessionId] ?? EMPTY_SESSION
}

export function subscribeAiWorkspaceSession(_sessionId: string, listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAiWorkspaceSessionMessages(
  sessionId: string,
  next: SetStateAction<AiAgentMessage[]>,
): void {
  const current = aiWorkspaceSessionSnapshot(sessionId)
  const messages = typeof next === 'function' ? next(current.messages) : next
  sessions = {
    ...sessions,
    [sessionId]: {
      ...current,
      messages,
    },
  }
  publishSessions()
}

export function setAiWorkspaceSessionStatus(
  sessionId: string,
  next: SetStateAction<AgentStatus>,
): void {
  const current = aiWorkspaceSessionSnapshot(sessionId)
  const status = typeof next === 'function' ? next(current.status) : next
  sessions = {
    ...sessions,
    [sessionId]: {
      ...current,
      status,
    },
  }
  publishSessions()
}

export function resetAiWorkspaceSession(sessionId: string): void {
  sessions = {
    ...sessions,
    [sessionId]: EMPTY_SESSION,
  }
  publishSessions()
}

export function cloneAiWorkspaceSessionUntilMessage(sourceSessionId: string, targetSessionId: string, messageId: string): void {
  const source = aiWorkspaceSessionSnapshot(sourceSessionId)
  const messageIndex = source.messages.findIndex((message) => message.id === messageId)
  const messages = messageIndex >= 0 ? source.messages.slice(0, messageIndex + 1) : source.messages
  sessions = {
    ...sessions,
    [targetSessionId]: {
      messages: messages.map((message) => ({ ...message, isStreaming: false })),
      status: 'idle',
    },
  }
  publishSessions()
}

export function aiWorkspaceSessionDispatchers(sessionId: string): {
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>
  setStatus: Dispatch<SetStateAction<AgentStatus>>
} {
  return {
    setMessages: (next) => setAiWorkspaceSessionMessages(sessionId, next),
    setStatus: (next) => setAiWorkspaceSessionStatus(sessionId, next),
  }
}

export function resetAiWorkspaceSessionStoreForTests(): void {
  sessions = {}
  writeStoredSessions()
  notifyListeners()
}
