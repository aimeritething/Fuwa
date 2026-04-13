import type { CommandAction } from './types'

interface AiAgentCommandsConfig {
  selectedAiAgentLabel?: string
  onOpenAiAgents?: () => void
  onCycleDefaultAiAgent?: () => void
}

export function buildAiAgentCommands({
  selectedAiAgentLabel,
  onOpenAiAgents,
  onCycleDefaultAiAgent,
}: AiAgentCommandsConfig): CommandAction[] {
  return [
    {
      id: 'open-ai-agents',
      label: 'Open AI Agents',
      group: 'Settings',
      keywords: ['ai', 'agent', 'agents', 'assistant', 'claude', 'codex', 'settings'],
      enabled: !!onOpenAiAgents,
      execute: () => onOpenAiAgents?.(),
    },
    {
      id: 'switch-default-ai-agent',
      label: selectedAiAgentLabel ? `Switch Default AI Agent (${selectedAiAgentLabel})` : 'Switch Default AI Agent',
      group: 'Settings',
      keywords: ['ai', 'agent', 'default', 'switch', 'claude', 'codex'],
      enabled: !!onCycleDefaultAiAgent,
      execute: () => onCycleDefaultAiAgent?.(),
    },
  ]
}
