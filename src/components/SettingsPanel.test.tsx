import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsPanel } from './SettingsPanel'
import type { Settings } from '../types'

const emptySettings: Settings = {
  auto_pull_interval_minutes: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
}

describe('SettingsPanel', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <SettingsPanel open={false} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal when open', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })

  it('does not show AI Provider Keys section', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.queryByText('AI Provider Keys')).not.toBeInTheDocument()
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument()
    expect(screen.queryByText('Google AI')).not.toBeInTheDocument()
  })

  it('calls onSave with settings on save', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auto_pull_interval_minutes: 5,
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('defaults the organization workflow switch to on', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByRole('switch', { name: 'Organize notes explicitly' })).toHaveAttribute('aria-checked', 'true')
  })

  it('saves the organization workflow preference when toggled off', () => {
    const onSaveExplicitOrganization = vi.fn()
    render(
      <SettingsPanel
        open={true}
        settings={emptySettings}
        onSave={onSave}
        explicitOrganizationEnabled={true}
        onSaveExplicitOrganization={onSaveExplicitOrganization}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Organize notes explicitly' }))
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSaveExplicitOrganization).toHaveBeenCalledWith(false)
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTitle('Close settings'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape key', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves on Cmd+Enter', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Enter', metaKey: true })

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auto_pull_interval_minutes: 5,
    }))
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('settings-panel'))
    expect(onClose).toHaveBeenCalled()
  })


  it('shows keyboard shortcut hint in footer', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText(/to open settings/)).toBeInTheDocument()
  })

  it('does not show the removed GitHub auth section', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
    expect(screen.queryByText(/Connect your GitHub account/i)).not.toBeInTheDocument()
  })

  describe('Privacy & Telemetry section', () => {
    it('renders crash reporting and analytics toggles', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )
      expect(screen.getByTestId('settings-crash-reporting')).toBeInTheDocument()
      expect(screen.getByTestId('settings-analytics')).toBeInTheDocument()
    })

    it('toggles reflect initial settings state', () => {
      const withTelemetry: Settings = {
        ...emptySettings,
        telemetry_consent: true,
        crash_reporting_enabled: true,
        analytics_enabled: false,
        anonymous_id: 'test-uuid',
      }
      render(
        <SettingsPanel open={true} settings={withTelemetry} onSave={onSave} onClose={onClose} />
      )
      const crashCheckbox = screen.getByTestId('settings-crash-reporting').querySelector('input') as HTMLInputElement
      const analyticsCheckbox = screen.getByTestId('settings-analytics').querySelector('input') as HTMLInputElement
      expect(crashCheckbox.checked).toBe(true)
      expect(analyticsCheckbox.checked).toBe(false)
    })

    it('saves telemetry settings when toggled and saved', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )
      const crashCheckbox = screen.getByTestId('settings-crash-reporting').querySelector('input')!
      fireEvent.click(crashCheckbox)
      fireEvent.click(screen.getByTestId('settings-save'))

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        crash_reporting_enabled: true,
        analytics_enabled: false,
      }))
    })
  })
})
