import {
  AI_AGENT_DEFINITIONS,
  createMissingAiAgentsStatus,
  getAiAgentDefinition,
  resolveDefaultAiAgent,
  type AiAgentId,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { X } from '@phosphor-icons/react'
import type { Settings } from '../types'
import { normalizeReleaseChannel, serializeReleaseChannel, type ReleaseChannel } from '../lib/releaseChannel'
import { trackEvent } from '../lib/telemetry'
import { Button } from './ui/button'
import { Checkbox, type CheckedState } from './ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Switch } from './ui/switch'

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  aiAgentsStatus?: AiAgentsStatus
  onSave: (settings: Settings) => void
  explicitOrganizationEnabled?: boolean
  onSaveExplicitOrganization?: (enabled: boolean) => void
  onClose: () => void
}

interface SettingsDraft {
  pullInterval: number
  defaultAiAgent: AiAgentId
  releaseChannel: ReleaseChannel
  initialH1AutoRename: boolean
  crashReporting: boolean
  analytics: boolean
  explicitOrganization: boolean
}

interface SettingsBodyProps {
  pullInterval: number
  setPullInterval: (value: number) => void
  aiAgentsStatus: AiAgentsStatus
  defaultAiAgent: AiAgentId
  setDefaultAiAgent: (value: AiAgentId) => void
  releaseChannel: ReleaseChannel
  setReleaseChannel: (value: ReleaseChannel) => void
  initialH1AutoRename: boolean
  setInitialH1AutoRename: (value: boolean) => void
  explicitOrganization: boolean
  setExplicitOrganization: (value: boolean) => void
  crashReporting: boolean
  setCrashReporting: (value: boolean) => void
  analytics: boolean
  setAnalytics: (value: boolean) => void
}

const PULL_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30] as const

function isSaveShortcut(event: ReactKeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

function createSettingsDraft(
  settings: Settings,
  explicitOrganizationEnabled: boolean,
): SettingsDraft {
  return {
    pullInterval: settings.auto_pull_interval_minutes ?? 5,
    defaultAiAgent: resolveDefaultAiAgent(settings.default_ai_agent),
    releaseChannel: normalizeReleaseChannel(settings.release_channel),
    initialH1AutoRename: settings.initial_h1_auto_rename_enabled ?? true,
    crashReporting: settings.crash_reporting_enabled ?? false,
    analytics: settings.analytics_enabled ?? false,
    explicitOrganization: explicitOrganizationEnabled,
  }
}

function resolveTelemetryConsent(settings: Settings, draft: SettingsDraft): boolean | null {
  if (draft.crashReporting || draft.analytics) return true
  return settings.telemetry_consent === null ? null : false
}

function resolveAnonymousId(settings: Settings, draft: SettingsDraft): string | null {
  if (draft.crashReporting || draft.analytics) {
    return settings.anonymous_id ?? crypto.randomUUID()
  }

  return settings.anonymous_id
}

function buildSettingsFromDraft(settings: Settings, draft: SettingsDraft): Settings {
  return {
    auto_pull_interval_minutes: draft.pullInterval,
    telemetry_consent: resolveTelemetryConsent(settings, draft),
    crash_reporting_enabled: draft.crashReporting,
    analytics_enabled: draft.analytics,
    anonymous_id: resolveAnonymousId(settings, draft),
    release_channel: serializeReleaseChannel(draft.releaseChannel),
    initial_h1_auto_rename_enabled: draft.initialH1AutoRename,
    default_ai_agent: draft.defaultAiAgent,
  }
}

function trackTelemetryConsentChange(previousAnalytics: boolean, nextAnalytics: boolean): void {
  if (!previousAnalytics && nextAnalytics) trackEvent('telemetry_opted_in')
  if (previousAnalytics && !nextAnalytics) trackEvent('telemetry_opted_out')
}

function isChecked(checked: CheckedState): boolean {
  return checked === true
}

export function SettingsPanel({
  open,
  settings,
  aiAgentsStatus = createMissingAiAgentsStatus(),
  onSave,
  explicitOrganizationEnabled = true,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null

  return (
    <SettingsPanelInner
      settings={settings}
      aiAgentsStatus={aiAgentsStatus}
      onSave={onSave}
      explicitOrganizationEnabled={explicitOrganizationEnabled}
      onSaveExplicitOrganization={onSaveExplicitOrganization}
      onClose={onClose}
    />
  )
}

type SettingsPanelInnerProps = Omit<SettingsPanelProps, 'open' | 'explicitOrganizationEnabled' | 'aiAgentsStatus'> & {
  aiAgentsStatus: AiAgentsStatus
  explicitOrganizationEnabled: boolean
}

function SettingsPanelInner({
  settings,
  aiAgentsStatus,
  onSave,
  explicitOrganizationEnabled,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelInnerProps) {
  const [draft, setDraft] = useState(() => createSettingsDraft(settings, explicitOrganizationEnabled))
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const focusTarget = panelRef.current?.querySelector<HTMLElement>('[data-settings-autofocus="true"]')
      focusTarget?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const updateDraft = useCallback(
    <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => {
      setDraft((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const handleSave = useCallback(() => {
    trackTelemetryConsentChange(settings.analytics_enabled === true, draft.analytics)
    onSave(buildSettingsFromDraft(settings, draft))
    onSaveExplicitOrganization?.(draft.explicitOrganization)
    onClose()
  }, [draft, onClose, onSave, onSaveExplicitOrganization, settings])

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose()
    },
    [onClose],
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (isSaveShortcut(event)) {
        event.preventDefault()
        handleSave()
      }
    },
    [handleSave, onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      data-testid="settings-panel"
    >
      <div
        ref={panelRef}
        className="bg-background border border-border rounded-lg shadow-xl"
        style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <SettingsHeader onClose={onClose} />
        <SettingsBody
          pullInterval={draft.pullInterval}
          setPullInterval={(value) => updateDraft('pullInterval', value)}
          aiAgentsStatus={aiAgentsStatus}
          defaultAiAgent={draft.defaultAiAgent}
          setDefaultAiAgent={(value) => updateDraft('defaultAiAgent', value)}
          releaseChannel={draft.releaseChannel}
          setReleaseChannel={(value) => updateDraft('releaseChannel', value)}
          initialH1AutoRename={draft.initialH1AutoRename}
          setInitialH1AutoRename={(value) => updateDraft('initialH1AutoRename', value)}
          explicitOrganization={draft.explicitOrganization}
          setExplicitOrganization={(value) => updateDraft('explicitOrganization', value)}
          crashReporting={draft.crashReporting}
          setCrashReporting={(value) => updateDraft('crashReporting', value)}
          analytics={draft.analytics}
          setAnalytics={(value) => updateDraft('analytics', value)}
        />
        <SettingsFooter onClose={onClose} onSave={handleSave} />
      </div>
    </div>
  )
}

function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderBottom: '1px solid var(--border)' }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Settings</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        title="Close settings"
        aria-label="Close settings"
      >
        <X size={16} />
      </Button>
    </div>
  )
}

function SettingsBody({
  pullInterval,
  setPullInterval,
  aiAgentsStatus,
  defaultAiAgent,
  setDefaultAiAgent,
  releaseChannel,
  setReleaseChannel,
  initialH1AutoRename,
  setInitialH1AutoRename,
  explicitOrganization,
  setExplicitOrganization,
  crashReporting,
  setCrashReporting,
  analytics,
  setAnalytics,
}: SettingsBodyProps) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
      <SectionHeading
        title="Sync"
        description="Automatically pull vault changes from Git in the background."
      />

      <LabeledSelect
        label="Pull interval (minutes)"
        value={`${pullInterval}`}
        onValueChange={(value) => setPullInterval(Number(value))}
        options={PULL_INTERVAL_OPTIONS.map((value) => ({
          value: `${value}`,
          label: `${value}`,
        }))}
        testId="settings-pull-interval"
        autoFocus={true}
      />

      <Divider />

      <SectionHeading
        title="Titles & Filenames"
        description="Choose whether Tolaria automatically syncs untitled note filenames from the first H1 title."
      />

      <SettingsSwitchRow
        label="Auto-rename untitled notes from first H1"
        description="When enabled, Tolaria renames untitled-note files as soon as the first H1 becomes a real title. Turn this off to keep the filename unchanged until you rename it manually from the breadcrumb bar."
        checked={initialH1AutoRename}
        onChange={setInitialH1AutoRename}
        testId="settings-initial-h1-auto-rename"
      />

      <Divider />

      <SectionHeading
        title="AI Agents"
        description="Choose which CLI AI agent Tolaria uses in the AI panel and command palette."
      />

      <LabeledSelect
        label="Default AI agent"
        value={defaultAiAgent}
        onValueChange={(value) => setDefaultAiAgent(value as AiAgentId)}
        options={AI_AGENT_DEFINITIONS.map((definition) => {
          const status = aiAgentsStatus[definition.id]
          const suffix = status.status === 'installed'
            ? ` (installed${status.version ? ` ${status.version}` : ''})`
            : ' (missing)'
          return {
            value: definition.id,
            label: `${definition.label}${suffix}`,
          }
        })}
        testId="settings-default-ai-agent"
      />

      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
        {renderDefaultAiAgentSummary(defaultAiAgent, aiAgentsStatus)}
      </div>

      <Divider />

      <SectionHeading
        title="Release Channel"
        description="Controls which update feed Tolaria polls. Stable only receives manually promoted releases. Alpha follows every push to main."
      />

      <LabeledSelect
        label="Release channel"
        value={releaseChannel}
        onValueChange={(value) => setReleaseChannel(value as ReleaseChannel)}
        options={[
          { value: 'stable', label: 'Stable' },
          { value: 'alpha', label: 'Alpha' },
        ]}
        testId="settings-release-channel"
      />

      <Divider />

      <OrganizationWorkflowSection
        checked={explicitOrganization}
        onChange={setExplicitOrganization}
      />

      <Divider />

      <SectionHeading
        title="Privacy & Telemetry"
        description="Anonymous data helps us fix bugs and improve Tolaria. No vault content, note titles, or file paths are ever sent."
      />

      <TelemetryToggle
        label="Crash reporting"
        description="Send anonymous error reports"
        checked={crashReporting}
        onChange={setCrashReporting}
        testId="settings-crash-reporting"
      />
      <TelemetryToggle
        label="Usage analytics"
        description="Share anonymous usage patterns"
        checked={analytics}
        onChange={setAnalytics}
        testId="settings-analytics"
      />
    </div>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)' }} />
}

function renderDefaultAiAgentSummary(defaultAiAgent: AiAgentId, aiAgentsStatus: AiAgentsStatus): string {
  const definition = getAiAgentDefinition(defaultAiAgent)
  const status = aiAgentsStatus[defaultAiAgent]
  if (status.status === 'installed') {
    return `${definition.label}${status.version ? ` ${status.version}` : ''} is ready to use.`
  }
  return `${definition.label} is not installed yet. You can still select it now and install it later.`
}

function LabeledSelect({
  label,
  value,
  onValueChange,
  options,
  testId,
  autoFocus = false,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  testId: string
  autoFocus?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className="w-full bg-transparent"
          data-testid={testId}
          data-value={value}
          data-settings-autofocus={autoFocus ? 'true' : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function OrganizationWorkflowSection({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <>
      <SectionHeading
        title="Workflow"
        description="Choose whether Tolaria shows the Inbox workflow and the organized toggle."
      />

      <SettingsSwitchRow
        label="Organize notes explicitly"
        description="When enabled, an Inbox section shows unorganized notes, and a toggle lets you mark notes as organized."
        checked={checked}
        onChange={onChange}
        testId="settings-explicit-organization"
      />
    </>
  )
}

function SettingsSwitchRow({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  testId?: string
}) {
  return (
    <label
      className="flex items-start justify-between gap-3"
      style={{ cursor: 'pointer' }}
      data-testid={testId}
    >
      <div className="space-y-1">
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

function TelemetryToggle({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  testId: string
}) {
  return (
    <label className="flex items-center gap-3" style={{ cursor: 'pointer' }} data-testid={testId}>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(isChecked(value))} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{description}</div>
      </div>
    </label>
  )
}

function SettingsFooter({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderTop: '1px solid var(--border)' }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{'\u2318'}, to open settings</span>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave} data-testid="settings-save">
          Save
        </Button>
      </div>
    </div>
  )
}
