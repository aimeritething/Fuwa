import type { VaultEntry } from '../types'

export type VaultAiGuidanceFileState = 'checking' | 'managed' | 'missing' | 'broken' | 'custom'

export interface VaultAiGuidanceStatus {
  agentsState: VaultAiGuidanceFileState
  claudeState: VaultAiGuidanceFileState
  canRestore: boolean
}

type RawVaultAiGuidanceStatus = Partial<{
  agents_state: VaultAiGuidanceFileState | null
  claude_state: VaultAiGuidanceFileState | null
  can_restore: boolean | null
}>

const GUIDANCE_FILENAMES = new Set(['AGENTS.md', 'CLAUDE.md'])

export function createCheckingVaultAiGuidanceStatus(): VaultAiGuidanceStatus {
  return {
    agentsState: 'checking',
    claudeState: 'checking',
    canRestore: false,
  }
}

function normalizeFileState(value: string | null | undefined): VaultAiGuidanceFileState {
  switch (value) {
    case 'managed':
    case 'missing':
    case 'broken':
    case 'custom':
      return value
    default:
      return 'checking'
  }
}

export function normalizeVaultAiGuidanceStatus(
  payload: RawVaultAiGuidanceStatus | null | undefined,
): VaultAiGuidanceStatus {
  return {
    agentsState: normalizeFileState(payload?.agents_state),
    claudeState: normalizeFileState(payload?.claude_state),
    canRestore: payload?.can_restore === true,
  }
}

export function isVaultAiGuidanceStatusChecking(status: VaultAiGuidanceStatus): boolean {
  return status.agentsState === 'checking' || status.claudeState === 'checking'
}

export function vaultAiGuidanceNeedsRestore(status: VaultAiGuidanceStatus): boolean {
  if (!status.canRestore || isVaultAiGuidanceStatusChecking(status)) return false
  return status.agentsState === 'missing'
    || status.agentsState === 'broken'
    || status.claudeState === 'missing'
    || status.claudeState === 'broken'
}

export function vaultAiGuidanceUsesCustomFiles(status: VaultAiGuidanceStatus): boolean {
  return status.agentsState === 'custom' || status.claudeState === 'custom'
}

function isMissingOrBroken(state: VaultAiGuidanceFileState): boolean {
  return state === 'missing' || state === 'broken'
}

function getBrokenGuidanceSummary(status: VaultAiGuidanceStatus): string | null {
  if (isMissingOrBroken(status.agentsState)) {
    return 'Tolaria guidance missing or broken'
  }
  if (isMissingOrBroken(status.claudeState)) {
    return 'Claude compatibility shim missing or broken'
  }
  return null
}

function getCustomGuidanceSummary(status: VaultAiGuidanceStatus): string | null {
  if (status.agentsState === 'custom' && status.claudeState === 'custom') {
    return 'Custom AGENTS.md and CLAUDE.md active'
  }
  if (status.agentsState === 'custom') return 'Using custom AGENTS.md'
  if (status.claudeState === 'custom') return 'Using custom CLAUDE.md'
  return null
}

export function getVaultAiGuidanceSummary(status: VaultAiGuidanceStatus): string {
  if (isVaultAiGuidanceStatusChecking(status)) return 'Checking vault guidance…'
  const brokenSummary = getBrokenGuidanceSummary(status)
  if (brokenSummary) return brokenSummary
  const customSummary = getCustomGuidanceSummary(status)
  if (customSummary) return customSummary
  return 'Tolaria guidance ready'
}

export function buildVaultAiGuidanceRefreshKey(entries: VaultEntry[]): string {
  return entries
    .filter((entry) => GUIDANCE_FILENAMES.has(entry.filename))
    .map((entry) => `${entry.path}:${entry.modifiedAt ?? 0}:${entry.fileSize}`)
    .sort()
    .join('|')
}
