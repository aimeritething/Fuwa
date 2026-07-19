import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import {
  catalogFromCapabilities,
  type AiAgentModelCatalog,
} from '../lib/aiAgentModels'

interface AiAgentModelCatalogState {
  catalog: AiAgentModelCatalog
  ready: boolean
}

export function useAiAgentModelCatalog(enabled: boolean): AiAgentModelCatalogState {
  const [state, setState] = useState<AiAgentModelCatalogState>({ catalog: {}, ready: false })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const request = isTauri()
      ? invoke<unknown>('get_ai_agent_model_catalog')
      : mockInvoke<unknown>('get_ai_agent_model_catalog')
    void request.then((capabilities) => {
      if (!cancelled) setState({ catalog: catalogFromCapabilities(capabilities), ready: true })
    }).catch(() => {
      if (!cancelled) setState({ catalog: {}, ready: true })
    })
    return () => { cancelled = true }
  }, [enabled])

  return state
}
