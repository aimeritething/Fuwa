import type { Dispatch, SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AgentStatus, AiAgentMessage } from './aiAgentConversation'
import { isTauri } from '../mock-tauri'

const STORAGE_KEY = 'tolaria:ai-workspace-sessions:v1'
const BROADCAST_CHANNEL = 'tolaria-ai-workspace-sessions'
const NATIVE_WRITE_DEBOUNCE_MS = 250

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
let storeVersion = 0
let nativeWriteTimer: ReturnType<typeof setTimeout> | null = null
let nativeWriteInFlight = false
let pendingNativeSessions: SessionMap | null = null

function isSessionSnapshot(value: unknown): value is AiWorkspaceSessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AiWorkspaceSessionSnapshot>
  return Array.isArray(candidate.messages) && typeof candidate.status === 'string'
}

function normalizeStoredStatus(value: unknown, resetRunningStatus: boolean): AgentStatus {
  switch (value) {
    case 'idle':
    case 'done':
    case 'error':
      return value
    case 'thinking':
    case 'tool-executing':
      return resetRunningStatus ? 'idle' : value
    default:
      return 'idle'
  }
}

function normalizeStoredMessages(messages: AiAgentMessage[], resetRunningStatus: boolean): AiAgentMessage[] {
  if (!resetRunningStatus) return messages
  return messages.map((message) => (
    message.isStreaming ? { ...message, isStreaming: false } : message
  ))
}

function normalizeStoredSessions(value: unknown, resetRunningStatus: boolean): SessionMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, AiWorkspaceSessionSnapshot] => (
      typeof entry[0] === 'string' && isSessionSnapshot(entry[1])
    )).map(([sessionId, session]) => [
      sessionId,
      {
        messages: normalizeStoredMessages(session.messages, resetRunningStatus),
        status: normalizeStoredStatus(session.status, resetRunningStatus),
      },
    ]),
  )
}

function readStoredSessions(resetRunningStatus = true): SessionMap {
  if (typeof localStorage === 'undefined') return {}

  try {
    return normalizeStoredSessions(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'), resetRunningStatus)
  } catch {
    return {}
  }
}

function writeStoredSessions(): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Native persistence is the durable backend; localStorage is only a fast browser cache.
  }
}

async function readNativeSessions(): Promise<SessionMap> {
  if (!isTauri()) return {}

  try {
    const stored = await invoke<unknown>('get_ai_workspace_sessions')
    return normalizeStoredSessions(stored, true)
  } catch {
    return {}
  }
}

async function flushNativeSessionsWrite(): Promise<void> {
  if (!isTauri() || nativeWriteInFlight || !pendingNativeSessions) return

  nativeWriteInFlight = true
  const nextSessions = pendingNativeSessions
  pendingNativeSessions = null
  nativeWriteTimer = null

  try {
    await invoke('save_ai_workspace_sessions', { sessions: nextSessions })
  } catch {
    // Transcript persistence should never interrupt the chat UI.
  } finally {
    nativeWriteInFlight = false
    if (pendingNativeSessions) scheduleNativeSessionsWrite(pendingNativeSessions)
  }
}

function scheduleNativeSessionsWrite(nextSessions: SessionMap): void {
  if (!isTauri()) return

  pendingNativeSessions = nextSessions
  if (nativeWriteTimer || nativeWriteInFlight) return

  nativeWriteTimer = setTimeout(() => {
    void flushNativeSessionsWrite()
  }, NATIVE_WRITE_DEBOUNCE_MS)
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
  storeVersion += 1
  writeStoredSessions()
  scheduleNativeSessionsWrite(sessions)
  broadcastSessions()
  notifyListeners()
}

function replaceSessions(nextSessions: SessionMap): void {
  sessions = nextSessions
  notifyListeners()
}

function syncFromStorage(): void {
  replaceSessions(readStoredSessions(false))
}

async function syncFromNativeStorage(): Promise<void> {
  const loadVersion = storeVersion
  const nativeSessions = await readNativeSessions()
  if (storeVersion !== loadVersion) return
  if (Object.keys(nativeSessions).length === 0) {
    if (Object.keys(sessions).length > 0) scheduleNativeSessionsWrite(sessions)
    return
  }

  replaceSessions(nativeSessions)
  writeStoredSessions()
}

function ensureCrossWindowSync(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) syncFromStorage()
  })

  window.addEventListener('pagehide', () => {
    if (nativeWriteTimer) clearTimeout(nativeWriteTimer)
    nativeWriteTimer = null
    void flushNativeSessionsWrite()
  })

  if (typeof BroadcastChannel === 'undefined') return
  broadcastChannel ??= new BroadcastChannel(BROADCAST_CHANNEL)
  broadcastChannel.onmessage = syncFromStorage
}

ensureCrossWindowSync()
void syncFromNativeStorage()

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
  storeVersion = 0
  pendingNativeSessions = null
  if (nativeWriteTimer) clearTimeout(nativeWriteTimer)
  nativeWriteTimer = null
  nativeWriteInFlight = false
  writeStoredSessions()
  notifyListeners()
}
