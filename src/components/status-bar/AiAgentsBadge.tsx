import { AlertTriangle, ChevronsUpDown, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AI_AGENT_DEFINITIONS,
  getAiAgentDefinition,
  hasAnyInstalledAiAgent,
  isAiAgentInstalled,
  isAiAgentsStatusChecking,
  type AiAgentId,
  type AiAgentDefinition,
  type AiAgentsStatus,
} from '../../lib/aiAgents'
import {
  getVaultAiGuidanceSummary,
  isVaultAiGuidanceStatusChecking,
  vaultAiGuidanceNeedsRestore,
  vaultAiGuidanceUsesCustomFiles,
  type VaultAiGuidanceStatus,
} from '../../lib/vaultAiGuidance'
import { openExternalUrl } from '../../utils/url'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ICON_STYLE, SEP_STYLE } from './styles'

interface AiAgentsBadgeProps {
  statuses: AiAgentsStatus
  guidanceStatus?: VaultAiGuidanceStatus
  defaultAgent: AiAgentId
  onSetDefaultAgent?: (agent: AiAgentId) => void
  onRestoreGuidance?: () => void
}

function badgeTooltip(
  statuses: AiAgentsStatus,
  defaultAgent: AiAgentId,
  guidanceStatus?: VaultAiGuidanceStatus,
): string {
  const guidanceSummary = guidanceStatus && !isVaultAiGuidanceStatusChecking(guidanceStatus)
    ? getVaultAiGuidanceSummary(guidanceStatus)
    : null
  if (!hasAnyInstalledAiAgent(statuses)) return 'No AI agents detected — click for setup details'
  const definition = getAiAgentDefinition(defaultAgent)
  if (!isAiAgentInstalled(statuses, defaultAgent)) {
    return `${definition.label} is selected but not installed — click for setup details`
  }
  const version = statuses[defaultAgent].version
  const base = `Default AI agent: ${definition.label}${version ? ` ${version}` : ''}`
  if (!guidanceSummary) return base
  if (vaultAiGuidanceNeedsRestore(guidanceStatus!)) {
    return `${base}. ${guidanceSummary} — click for restore details`
  }
  if (vaultAiGuidanceUsesCustomFiles(guidanceStatus!)) {
    return `${base}. ${guidanceSummary}`
  }
  return base
}

function installedAgentDefinitions(statuses: AiAgentsStatus): AiAgentDefinition[] {
  return AI_AGENT_DEFINITIONS.filter((definition) => isAiAgentInstalled(statuses, definition.id))
}

function missingAgentDefinitions(statuses: AiAgentsStatus): AiAgentDefinition[] {
  return AI_AGENT_DEFINITIONS.filter((definition) => !isAiAgentInstalled(statuses, definition.id))
}

function triggerLabel(defaultAgent: AiAgentId, selectedAgentReady: boolean): string {
  const definition = getAiAgentDefinition(defaultAgent)
  return selectedAgentReady
    ? `AI: ${definition.shortLabel}`
    : `AI: ${definition.shortLabel} unavailable`
}

function menuHeading(defaultAgent: AiAgentId, selectedAgentReady: boolean): string {
  return selectedAgentReady
    ? `Active AI agent: ${getAiAgentDefinition(defaultAgent).label}`
    : `Selected AI agent unavailable: ${getAiAgentDefinition(defaultAgent).label}`
}

function statusText(statuses: AiAgentsStatus, definition: AiAgentDefinition): string {
  const version = statuses[definition.id].version
  return version ? `${definition.label} ${version}` : definition.label
}

function canSwitchAgents(
  installedAgents: AiAgentDefinition[],
  defaultAgent: AiAgentId,
): boolean {
  return installedAgents.some((definition) => definition.id !== defaultAgent)
}

function GuidanceMenuSection({
  guidanceStatus,
  onRestoreGuidance,
}: Pick<AiAgentsBadgeProps, 'guidanceStatus' | 'onRestoreGuidance'>) {
  if (!guidanceStatus || isVaultAiGuidanceStatusChecking(guidanceStatus)) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Vault guidance</DropdownMenuLabel>
      <DropdownMenuItem disabled data-testid="status-ai-guidance-summary">
        {getVaultAiGuidanceSummary(guidanceStatus)}
      </DropdownMenuItem>
      {vaultAiGuidanceNeedsRestore(guidanceStatus) && guidanceStatus.canRestore && (
        <DropdownMenuItem
          onSelect={() => onRestoreGuidance?.()}
          data-testid="status-ai-guidance-restore"
        >
          Restore Tolaria AI Guidance
        </DropdownMenuItem>
      )}
    </>
  )
}

function AgentMenuContent({
  statuses,
  guidanceStatus,
  defaultAgent,
  selectedAgentReady,
  onSetDefaultAgent,
  onRestoreGuidance,
}: AiAgentsBadgeProps & { selectedAgentReady: boolean }) {
  const installedAgents = installedAgentDefinitions(statuses)
  const missingAgents = missingAgentDefinitions(statuses)

  return (
    <DropdownMenuContent
      align="start"
      side="top"
      className="min-w-[18rem]"
      data-testid="status-ai-agents-menu"
    >
      <DropdownMenuLabel>{menuHeading(defaultAgent, selectedAgentReady)}</DropdownMenuLabel>
      {installedAgents.length === 0 ? (
        <DropdownMenuItem disabled>No AI agents detected</DropdownMenuItem>
      ) : (
        <DropdownMenuRadioGroup
          value={selectedAgentReady ? defaultAgent : undefined}
          onValueChange={(value) => onSetDefaultAgent?.(value as AiAgentId)}
        >
          {installedAgents.map((definition) => (
            <DropdownMenuRadioItem key={definition.id} value={definition.id}>
              <span>{definition.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {statusText(statuses, definition)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
      {missingAgents.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Install</DropdownMenuLabel>
          {missingAgents.map((definition) => (
            <DropdownMenuItem
              key={definition.id}
              onSelect={() => void openExternalUrl(definition.installUrl)}
            >
              Install {definition.label}
            </DropdownMenuItem>
          ))}
        </>
      )}
      <GuidanceMenuSection
        guidanceStatus={guidanceStatus}
        onRestoreGuidance={onRestoreGuidance}
      />
    </DropdownMenuContent>
  )
}

export function AiAgentsBadge({
  statuses,
  guidanceStatus,
  defaultAgent,
  onSetDefaultAgent,
  onRestoreGuidance,
}: AiAgentsBadgeProps) {
  const hasInstalledAgent = hasAnyInstalledAiAgent(statuses)
  const selectedAgentReady = isAiAgentInstalled(statuses, defaultAgent)
  const showWarning = !hasInstalledAgent
    || !selectedAgentReady
    || !!(guidanceStatus && vaultAiGuidanceNeedsRestore(guidanceStatus))
  const showSwitcherCue = canSwitchAgents(installedAgentDefinitions(statuses), defaultAgent)

  if (isAiAgentsStatusChecking(statuses)) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 px-2 text-[11px] font-medium"
            title={badgeTooltip(statuses, defaultAgent, guidanceStatus)}
            data-testid="status-ai-agents"
          >
            <span style={{ ...ICON_STYLE, color: showWarning ? 'var(--accent-orange)' : 'var(--muted-foreground)' }}>
              <Terminal size={13} />
              {triggerLabel(defaultAgent, selectedAgentReady)}
              {showWarning && <AlertTriangle size={10} style={{ marginLeft: 2 }} />}
              {!showWarning && showSwitcherCue && <ChevronsUpDown size={10} style={{ marginLeft: 2 }} />}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <AgentMenuContent
          statuses={statuses}
          guidanceStatus={guidanceStatus}
          defaultAgent={defaultAgent}
          onSetDefaultAgent={onSetDefaultAgent}
          onRestoreGuidance={onRestoreGuidance}
          selectedAgentReady={selectedAgentReady}
        />
      </DropdownMenu>
    </>
  )
}
