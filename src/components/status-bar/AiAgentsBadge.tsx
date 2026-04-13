import { useRef, useState } from 'react'
import { AlertTriangle, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AI_AGENT_DEFINITIONS,
  getAiAgentDefinition,
  hasAnyInstalledAiAgent,
  isAiAgentInstalled,
  isAiAgentsStatusChecking,
  type AiAgentId,
  type AiAgentsStatus,
} from '../../lib/aiAgents'
import { openExternalUrl } from '../../utils/url'
import { useDismissibleLayer } from './useDismissibleLayer'
import { ICON_STYLE, SEP_STYLE } from './styles'

interface AiAgentsBadgeProps {
  statuses: AiAgentsStatus
  defaultAgent: AiAgentId
}

function badgeTooltip(statuses: AiAgentsStatus, defaultAgent: AiAgentId): string {
  if (!hasAnyInstalledAiAgent(statuses)) return 'No AI agents detected — click for setup details'
  const definition = getAiAgentDefinition(defaultAgent)
  if (!isAiAgentInstalled(statuses, defaultAgent)) {
    return `${definition.label} is selected but not installed — click for setup details`
  }
  const version = statuses[defaultAgent].version
  return `Default AI agent: ${definition.label}${version ? ` ${version}` : ''}`
}

function AgentPopup({ statuses, defaultAgent }: { statuses: AiAgentsStatus; defaultAgent: AiAgentId }) {
  return (
    <div
      data-testid="status-ai-agents-popup"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        minWidth: 280,
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 10,
        background: 'var(--sidebar)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
      }}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        AI Agents
      </div>
      <div className="space-y-3">
        {AI_AGENT_DEFINITIONS.map((definition) => {
          const status = statuses[definition.id]
          const ready = status.status === 'installed'
          const selected = definition.id === defaultAgent
          return (
            <div
              key={definition.id}
              className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">
                    {definition.label}
                    {selected ? ' · Default' : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ready
                      ? `${definition.label}${status.version ? ` ${status.version}` : ''} is ready.`
                      : `${definition.label} is not installed.`}
                  </div>
                </div>
                {!ready && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => void openExternalUrl(definition.installUrl)}
                  >
                    Install
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AiAgentsBadge({ statuses, defaultAgent }: AiAgentsBadgeProps) {
  const [showPopup, setShowPopup] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const hasInstalledAgent = hasAnyInstalledAiAgent(statuses)
  const selectedAgentReady = isAiAgentInstalled(statuses, defaultAgent)
  const showWarning = !hasInstalledAgent || !selectedAgentReady

  useDismissibleLayer(showPopup, popupRef, () => setShowPopup(false))

  if (isAiAgentsStatusChecking(statuses)) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <div ref={popupRef} style={{ position: 'relative' }}>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 px-2 text-[11px] font-medium"
          title={badgeTooltip(statuses, defaultAgent)}
          data-testid="status-ai-agents"
          onClick={() => setShowPopup((current) => !current)}
        >
          <span style={{ ...ICON_STYLE, color: showWarning ? 'var(--accent-orange)' : 'var(--muted-foreground)' }}>
            <Terminal size={13} />
            AI Agents
            {showWarning && <AlertTriangle size={10} style={{ marginLeft: 2 }} />}
          </span>
        </Button>
        {showPopup && <AgentPopup statuses={statuses} defaultAgent={defaultAgent} />}
      </div>
    </>
  )
}
