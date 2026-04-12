import { useState, useRef, useCallback, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import type { Settings } from '../types'
import { trackEvent } from '../lib/telemetry'
import { Switch } from './ui/switch'

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  onSave: (settings: Settings) => void
  explicitOrganizationEnabled?: boolean
  onSaveExplicitOrganization?: (enabled: boolean) => void
  onClose: () => void
}

// --- Settings Panel ---

function isSaveShortcut(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

export function SettingsPanel({
  open,
  settings,
  onSave,
  explicitOrganizationEnabled = true,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null
  return (
    <SettingsPanelInner
      settings={settings}
      onSave={onSave}
      explicitOrganizationEnabled={explicitOrganizationEnabled}
      onSaveExplicitOrganization={onSaveExplicitOrganization}
      onClose={onClose}
    />
  )
}

type SettingsPanelInnerProps = Omit<SettingsPanelProps, 'open' | 'explicitOrganizationEnabled'> & {
  explicitOrganizationEnabled: boolean
}

function SettingsPanelInner({
  settings,
  onSave,
  explicitOrganizationEnabled,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelInnerProps) {
  const [pullInterval, setPullInterval] = useState(settings.auto_pull_interval_minutes ?? 5)
  const [releaseChannel, setReleaseChannel] = useState(settings.release_channel ?? 'stable')
  const [crashReporting, setCrashReporting] = useState(settings.crash_reporting_enabled ?? false)
  const [analytics, setAnalytics] = useState(settings.analytics_enabled ?? false)
  const [explicitOrganization, setExplicitOrganization] = useState(explicitOrganizationEnabled)
  const panelRef = useRef<HTMLDivElement>(null)

  // Auto-focus first input when settings panel opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = panelRef.current?.querySelector('input')
      input?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const buildSettings = useCallback((): Settings => ({
    auto_pull_interval_minutes: pullInterval,
    telemetry_consent: (crashReporting || analytics) ? true : (settings.telemetry_consent === null ? null : false),
    crash_reporting_enabled: crashReporting,
    analytics_enabled: analytics,
    anonymous_id: (crashReporting || analytics) ? (settings.anonymous_id ?? crypto.randomUUID()) : settings.anonymous_id,
    release_channel: releaseChannel === 'stable' ? null : releaseChannel,
  }), [pullInterval, releaseChannel, crashReporting, analytics, settings.telemetry_consent, settings.anonymous_id])

  const handleSave = () => {
    const prevAnalytics = settings.analytics_enabled ?? false
    const newAnalytics = analytics
    if (!prevAnalytics && newAnalytics) trackEvent('telemetry_opted_in')
    if (prevAnalytics && !newAnalytics) trackEvent('telemetry_opted_out')
    onSave(buildSettings())
    onSaveExplicitOrganization?.(explicitOrganization)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
    if (isSaveShortcut(e)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
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
          pullInterval={pullInterval} setPullInterval={setPullInterval}
          releaseChannel={releaseChannel} setReleaseChannel={setReleaseChannel}
          explicitOrganization={explicitOrganization}
          setExplicitOrganization={setExplicitOrganization}
          crashReporting={crashReporting} setCrashReporting={setCrashReporting}
          analytics={analytics} setAnalytics={setAnalytics}
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
      <button
        className="border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
        onClick={onClose}
        title="Close settings"
      >
        <X size={16} />
      </button>
    </div>
  )
}

interface SettingsBodyProps {
  pullInterval: number; setPullInterval: (v: number) => void
  releaseChannel: string; setReleaseChannel: (v: string) => void
  explicitOrganization: boolean; setExplicitOrganization: (v: boolean) => void
  crashReporting: boolean; setCrashReporting: (v: boolean) => void
  analytics: boolean; setAnalytics: (v: boolean) => void
}

function SettingsBody(props: SettingsBodyProps) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Sync</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Automatically pull vault changes from Git in the background.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>Pull interval (minutes)</label>
        <select
          value={props.pullInterval}
          onChange={(e) => props.setPullInterval(Number(e.target.value))}
          className="border border-border bg-transparent text-foreground rounded"
          style={{ fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
          data-testid="settings-pull-interval"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={30}>30</option>
        </select>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Release Channel</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Controls which features are visible. Alpha users see all features. Beta/Stable see features as they are promoted.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>Release channel</label>
        <select
          value={props.releaseChannel}
          onChange={(e) => props.setReleaseChannel(e.target.value)}
          className="border border-border bg-transparent text-foreground rounded"
          style={{ fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
          data-testid="settings-release-channel"
        >
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
          <option value="alpha">Alpha (bleeding edge)</option>
        </select>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <OrganizationWorkflowSection
        checked={props.explicitOrganization}
        onChange={props.setExplicitOrganization}
      />

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Privacy &amp; Telemetry</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Anonymous data helps us fix bugs and improve Tolaria. No vault content, note titles, or file paths are ever sent.
        </div>
      </div>

      <TelemetryToggle label="Crash reporting" description="Send anonymous error reports" checked={props.crashReporting} onChange={props.setCrashReporting} testId="settings-crash-reporting" />
      <TelemetryToggle label="Usage analytics" description="Share anonymous usage patterns" checked={props.analytics} onChange={props.setAnalytics} testId="settings-analytics" />
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
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Workflow</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Choose whether Tolaria shows the Inbox workflow and the organized toggle.
        </div>
      </div>

      <label
        className="flex items-start justify-between gap-3"
        style={{ cursor: 'pointer' }}
        data-testid="settings-explicit-organization"
      >
        <div className="space-y-1">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Organize notes explicitly</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            When enabled, an Inbox section shows unorganized notes, and a toggle lets you mark notes as organized.
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} aria-label="Organize notes explicitly" />
      </label>
    </>
  )
}

function TelemetryToggle({ label, description, checked, onChange, testId }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} data-testid={testId}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
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
        <button
          className="border border-border bg-transparent text-foreground rounded cursor-pointer hover:bg-accent"
          style={{ fontSize: 13, padding: '6px 16px' }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="border-none rounded cursor-pointer"
          style={{ fontSize: 13, padding: '6px 16px', background: 'var(--primary)', color: 'white' }}
          onClick={onSave}
          data-testid="settings-save"
        >
          Save
        </button>
      </div>
    </div>
  )
}
