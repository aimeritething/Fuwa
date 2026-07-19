import type { AiAgentId } from './aiAgents'
import { AI_AGENT_DEFINITIONS } from './aiAgents'

export const AGENT_DEFAULT_MODEL_ID = ''

export interface AiAgentModelOption {
  id: string
  label: string
}

export type AiAgentModelCatalog = Partial<Record<AiAgentId, AiAgentModelOption[]>>

interface RawAgentModelCapability {
  agent?: unknown
  models?: unknown
}

export function modelOptionsForAgent(
  _agent: AiAgentId,
  discovered: AiAgentModelOption[],
  defaultLabel: string,
): AiAgentModelOption[] {
  const seen = new Set<string>()
  const options = discovered.flatMap((option) => {
    const id = option.id.trim()
    const label = option.label.trim()
    if (!id || !label || seen.has(id)) return []
    seen.add(id)
    return [{ id, label }]
  })
  return [{ id: AGENT_DEFAULT_MODEL_ID, label: defaultLabel }, ...options]
}

function normalizedOptions(value: unknown): AiAgentModelOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const option = candidate as { id?: unknown; label?: unknown }
    if (typeof option.id !== 'string' || typeof option.label !== 'string') return []
    const id = option.id.trim()
    const label = option.label.trim()
    return id && label ? [{ id, label }] : []
  })
}

export function catalogFromCapabilities(value: unknown): AiAgentModelCatalog {
  if (!Array.isArray(value)) return {}
  const supported = new Set<string>(AI_AGENT_DEFINITIONS.map((definition) => definition.id))
  return Object.fromEntries(value.flatMap((candidate: RawAgentModelCapability) => {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.agent !== 'string') return []
    if (!supported.has(candidate.agent)) return []
    const models = normalizedOptions(candidate.models)
    return models.length > 0 ? [[candidate.agent, models]] : []
  })) as AiAgentModelCatalog
}

export { preferredAgentModel, setPreferredAgentModel } from './aiAgentModelPreferences'
