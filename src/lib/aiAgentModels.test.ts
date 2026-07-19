import { beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_DEFAULT_MODEL_ID,
  catalogFromCapabilities,
  modelOptionsForAgent,
  preferredAgentModel,
  setPreferredAgentModel,
} from './aiAgentModels'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
})

describe('aiAgentModels', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps verified model choices scoped to their agent', () => {
    setPreferredAgentModel('codex', 'gpt-5.6-sol')
    setPreferredAgentModel('claude_code', 'sonnet')

    expect(preferredAgentModel('codex')).toBe('gpt-5.6-sol')
    expect(preferredAgentModel('claude_code')).toBe('sonnet')
  })

  it('clears a named preference when Agent default is selected', () => {
    setPreferredAgentModel('codex', 'gpt-5.6-sol')
    setPreferredAgentModel('codex', AGENT_DEFAULT_MODEL_ID)

    expect(preferredAgentModel('codex')).toBeNull()
  })

  it('deduplicates malformed catalogs and always prepends Agent default', () => {
    const options = modelOptionsForAgent('codex', [
      { id: ' gpt-5.6-sol ', label: ' GPT-5.6 Sol ' },
      { id: 'gpt-5.6-sol', label: 'Duplicate' },
      { id: '', label: 'Invalid' },
    ], 'Agent default')

    expect(options).toEqual([
      { id: AGENT_DEFAULT_MODEL_ID, label: 'Agent default' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    ])
  })

  it('normalizes capabilities without mixing agent catalogs', () => {
    expect(catalogFromCapabilities([
      { agent: 'codex', models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }] },
      { agent: 'claude_code', models: [{ id: 'sonnet', label: 'Sonnet' }] },
      { agent: 'unknown', models: [{ id: 'private', label: 'Private' }] },
    ])).toEqual({
      claude_code: [{ id: 'sonnet', label: 'Sonnet' }],
      codex: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
    })
  })
})
