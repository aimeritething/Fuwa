import { Sparkle, Warning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  hasAnyInstalledAiAgent,
  isAiAgentInstalled,
  type AiAgentId,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import {
  resolveAiTarget,
  type AiModelProvider,
  type AiTarget,
} from '../lib/aiTargets'
import { translate, type AppLocale } from '../lib/i18n'
import {
  vaultAiGuidanceNeedsRestore,
  type VaultAiGuidanceStatus,
} from '../lib/vaultAiGuidance'
import type { Settings } from '../types'
import { AiAgentIcon } from './AiAgentIcon'

interface AiWorkspaceFloatingButtonProps {
  defaultAgent: AiAgentId
  defaultTarget?: string
  guidanceStatus?: VaultAiGuidanceStatus
  locale?: AppLocale
  providers?: AiModelProvider[]
  statuses: AiAgentsStatus
  onOpen: () => void
}

function selectedTargetForButton({
  defaultAgent,
  defaultTarget,
  providers,
}: Pick<AiWorkspaceFloatingButtonProps, 'defaultAgent' | 'defaultTarget' | 'providers'>): AiTarget {
  return resolveAiTarget({
    default_ai_agent: defaultAgent,
    default_ai_target: defaultTarget,
    ai_model_providers: providers ?? [],
  } as Settings)
}

function hasFloatingButtonWarning({
  guidanceStatus,
  selectedTarget,
  statuses,
}: {
  guidanceStatus?: VaultAiGuidanceStatus
  selectedTarget: AiTarget
  statuses: AiAgentsStatus
}): boolean {
  if (guidanceStatus && vaultAiGuidanceNeedsRestore(guidanceStatus)) return true
  if (selectedTarget.kind !== 'agent') return false
  return !hasAnyInstalledAiAgent(statuses) || !isAiAgentInstalled(statuses, selectedTarget.agent)
}

function FloatingButtonIcon({
  selectedTarget,
  showWarning,
}: {
  selectedTarget: AiTarget
  showWarning: boolean
}) {
  if (showWarning) return <Warning size={22} weight="regular" />
  if (selectedTarget.kind === 'agent') return <AiAgentIcon agent={selectedTarget.agent} size={24} />
  return <Sparkle size={22} weight="regular" />
}

export function AiWorkspaceFloatingButton({
  defaultAgent,
  defaultTarget,
  guidanceStatus,
  locale = 'en',
  providers = [],
  statuses,
  onOpen,
}: AiWorkspaceFloatingButtonProps) {
  const selectedTarget = selectedTargetForButton({ defaultAgent, defaultTarget, providers })
  const showWarning = hasFloatingButtonWarning({ guidanceStatus, selectedTarget, statuses })
  const label = translate(locale, 'editor.toolbar.openAi')

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="fixed right-5 bottom-11 z-30 size-12 rounded-full border border-border bg-background text-foreground shadow-[0_10px_28px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.12)] hover:bg-background hover:text-foreground"
      aria-label={label}
      title={label}
      data-tooltip-mode="native-title"
      data-testid="ai-workspace-floating-button"
      onClick={onOpen}
    >
      <span className={showWarning ? 'text-[var(--accent-orange)]' : undefined}>
        <FloatingButtonIcon selectedTarget={selectedTarget} showWarning={showWarning} />
      </span>
    </Button>
  )
}
