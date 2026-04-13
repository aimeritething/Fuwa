import { useCallback, useMemo, useState } from 'react'
import type { AiAgentId } from '../lib/aiAgents'
import { useCliAiAgent, type AgentFileCallbacks } from '../hooks/useCliAiAgent'
import type { VaultEntry } from '../types'
import {
  type NoteListItem,
  type NoteReference,
} from '../utils/ai-context'
import { useAiPanelContextSnapshot } from './useAiPanelContextSnapshot'

interface UseAiPanelControllerArgs {
  vaultPath: string
  defaultAiAgent: AiAgentId
  defaultAiAgentReady: boolean
  activeEntry?: VaultEntry | null
  activeNoteContent?: string | null
  entries?: VaultEntry[]
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  onOpenNote?: (path: string) => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
}

export function useAiPanelController({
  vaultPath,
  defaultAiAgent,
  defaultAiAgentReady,
  activeEntry,
  activeNoteContent,
  entries,
  openTabs,
  noteList,
  noteListFilter,
  onOpenNote,
  onFileCreated,
  onFileModified,
  onVaultChanged,
}: UseAiPanelControllerArgs) {
  const [input, setInput] = useState('')
  const { linkedEntries, contextPrompt } = useAiPanelContextSnapshot({
    activeEntry,
    activeNoteContent,
    entries,
    input,
    openTabs,
    noteList,
    noteListFilter,
  })

  const fileCallbacks = useMemo<AgentFileCallbacks>(() => ({
    onFileCreated,
    onFileModified,
    onVaultChanged,
  }), [onFileCreated, onFileModified, onVaultChanged])

  const agent = useCliAiAgent(vaultPath, contextPrompt, fileCallbacks, {
    agent: defaultAiAgent,
    agentReady: defaultAiAgentReady,
  })
  const hasContext = !!activeEntry
  const isActive = agent.status === 'thinking' || agent.status === 'tool-executing'

  const handleSend = useCallback((text: string, references: NoteReference[]) => {
    if (!text.trim() || isActive) return
    agent.sendMessage(text, references)
    setInput('')
  }, [agent, isActive])

  const handleNavigateWikilink = useCallback((target: string) => {
    onOpenNote?.(target)
  }, [onOpenNote])

  return {
    agent,
    input,
    setInput,
    linkedEntries,
    hasContext,
    isActive,
    handleSend,
    handleNavigateWikilink,
  }
}
