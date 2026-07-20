import { useCallback, useEffect, useRef } from 'react'
import type { AiWorkspaceMode } from '../components/aiWorkspaceSizing'
import type { AiAgentId } from '../lib/aiAgents'
import {
  AGENT_DEFAULT_MODEL_ID,
  modelOptionsForAgent,
  type AiAgentModelCatalog,
  type AiAgentModelOption,
} from '../lib/aiAgentModels'
import { setPreferredAgentModel } from '../lib/aiAgentModelPreferences'
import { trackAiAgentModelFallback, trackAiAgentModelSelected } from '../lib/productAnalytics'

export interface AgentModelSelection {
  agentId: AiAgentId | null
  options: AiAgentModelOption[]
  selectedId: string
  streamModelId?: string
  unavailableModelId: string | null
}

function selectionIsValid(discovered: AiAgentModelOption[], selectedModelId: string | null): boolean {
  if (!selectedModelId) return true
  return discovered.some((option) => option.id === selectedModelId)
}

function streamModelId(ready: boolean, valid: boolean, selectedModelId: string | null): string | undefined {
  if (!ready) return undefined
  if (!valid) return undefined
  return selectedModelId ?? undefined
}

function unavailableModelId(ready: boolean, valid: boolean, selectedModelId: string | null): string | null {
  if (!ready) return null
  if (valid) return null
  return selectedModelId
}

interface ResolveAgentModelSelectionOptions {
  agentId: AiAgentId | null
  catalog: AiAgentModelCatalog
  defaultLabel: string
  ready: boolean
  selectedModelId: string | null
}

export function resolveAgentModelSelection({
  agentId,
  catalog,
  defaultLabel,
  ready,
  selectedModelId,
}: ResolveAgentModelSelectionOptions): AgentModelSelection {
  const discovered = agentId ? (Reflect.get(catalog, agentId) as AiAgentModelCatalog[string] | undefined) ?? [] : []
  const valid = selectionIsValid(discovered, selectedModelId)
  return {
    agentId,
    options: agentId ? modelOptionsForAgent(agentId, discovered, defaultLabel) : [],
    selectedId: streamModelId(ready, valid, selectedModelId) ?? AGENT_DEFAULT_MODEL_ID,
    streamModelId: streamModelId(ready, valid, selectedModelId),
    unavailableModelId: unavailableModelId(ready, valid, selectedModelId),
  }
}

interface UseAiAgentModelActionsOptions {
  addLocalMarker: (message: string) => void
  disabled: boolean
  fallbackMessage: string
  onSelectModel: (modelId: string | null) => void
  selection: AgentModelSelection
  surface: AiWorkspaceMode
}

export function useAiAgentModelActions({
  addLocalMarker,
  disabled,
  fallbackMessage,
  onSelectModel,
  selection,
  surface,
}: UseAiAgentModelActionsOptions): (agentId: AiAgentId, modelId: string) => void {
  const fallbackModelRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selection.agentId || !selection.unavailableModelId) {
      fallbackModelRef.current = null
      return
    }
    if (fallbackModelRef.current === selection.unavailableModelId) return
    fallbackModelRef.current = selection.unavailableModelId
    setPreferredAgentModel(selection.agentId, null)
    onSelectModel(null)
    trackAiAgentModelFallback(selection.agentId, 'unavailable')
    addLocalMarker(fallbackMessage)
  }, [addLocalMarker, fallbackMessage, onSelectModel, selection.agentId, selection.unavailableModelId])

  return useCallback((agentId: AiAgentId, modelId: string) => {
    if (disabled) return
    const normalized = modelId.trim() || null
    setPreferredAgentModel(agentId, normalized)
    onSelectModel(normalized)
    trackAiAgentModelSelected(agentId, normalized === null, surface)
  }, [disabled, onSelectModel, surface])
}
