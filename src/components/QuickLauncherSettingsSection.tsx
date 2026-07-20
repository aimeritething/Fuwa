import { useEffect, useState, type KeyboardEvent } from 'react'
import { Keyboard } from '@phosphor-icons/react'
import type { TranslationKey } from '../lib/i18n'
import {
  DEFAULT_QUICK_LAUNCHER_SHORTCUT,
} from '../lib/quickLauncherShortcut'
import { quickLauncherShortcutFromKeyboardEvent } from '../lib/quickLauncherShortcutRecorder'
import {
  retryQuickLauncherShortcutRegistration,
  useQuickLauncherShortcutStatus,
} from '../hooks/useGlobalQuickLauncher'
import { loadQuickCaptureFolders } from '../lib/quickLauncherBackend'
import { flattenQuickLauncherFolders } from './quick-launcher/quickLauncherFolders'
import type { VaultOption } from './StatusBar'
import type {
  QuickLauncherSettingsChange,
  QuickLauncherSettingsValue,
} from '../lib/quickLauncherSettings'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  SectionHeading,
  SelectControl,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from './SettingsControls'
import { SETTINGS_SECTION_IDS } from './settingsSectionIds'

interface QuickLauncherSettingsSectionProps {
  captureFolder: string
  captureOpenAfterSave: boolean
  captureVaultPath: string
  onCaptureFolderChange: (value: string) => void
  onCaptureOpenAfterSaveChange: (value: boolean) => void
  onCaptureVaultPathChange: (value: string) => void
  onShortcutChange: (value: string) => void
  shortcut: string
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  vaults: readonly VaultOption[]
}

type Translate = QuickLauncherSettingsSectionProps['t']

function useCaptureFolders(vaultPath: string) {
  const [folders, setFolders] = useState<Array<{ label: string; path: string }>>([])
  useEffect(() => {
    if (!vaultPath) return
    let current = true
    void loadQuickCaptureFolders({ vaultPath }).then((nodes) => {
      if (current) setFolders(flattenQuickLauncherFolders(nodes))
    }).catch(() => {
      if (current) setFolders([])
    })
    return () => { current = false }
  }, [vaultPath])
  return folders
}

function shortcutStatusMessage(status: ReturnType<typeof useQuickLauncherShortcutStatus>, t: Translate): string {
  if (status.state === 'error') {
    return t('settings.quickLauncher.shortcutConflict', {
      shortcut: status.activeShortcut ?? t('settings.quickLauncher.none'),
    })
  }
  return status.state === 'active'
    ? t('settings.quickLauncher.shortcutActive', { shortcut: status.shortcut })
    : t('settings.quickLauncher.shortcutPending')
}

function ShortcutSettingsRow({
  onShortcutChange,
  shortcut,
  t,
}: Pick<QuickLauncherSettingsSectionProps, 'onShortcutChange' | 'shortcut' | 't'>) {
  const shortcutStatus = useQuickLauncherShortcutStatus()
  const recordShortcut = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const recorded = quickLauncherShortcutFromKeyboardEvent(event)
    if (recorded) onShortcutChange(recorded)
  }
  const hasConflict = shortcutStatus.state === 'error'
  return (
    <SettingsRow label={t('settings.quickLauncher.shortcut')} description={t('settings.quickLauncher.shortcutDescription')}>
      <div className="space-y-2">
        <Input value={shortcut} onKeyDown={recordShortcut} readOnly aria-label={t('settings.quickLauncher.shortcut')} className="bg-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={hasConflict ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} role="status">{shortcutStatusMessage(shortcutStatus, t)}</span>
          <div className="flex gap-2">
            {hasConflict && <Button type="button" size="xs" variant="outline" onClick={() => void retryQuickLauncherShortcutRegistration()}>{t('settings.quickLauncher.retry')}</Button>}
            <Button type="button" size="xs" variant="ghost" onClick={() => onShortcutChange(DEFAULT_QUICK_LAUNCHER_SHORTCUT)}>{t('settings.quickLauncher.reset')}</Button>
          </div>
        </div>
      </div>
    </SettingsRow>
  )
}

function availableVault(vault: VaultOption): boolean {
  return vault.available !== false && vault.mounted !== false
}

function CaptureDestinationSettingsRows({
  captureFolder,
  captureVaultPath,
  onCaptureFolderChange,
  onCaptureVaultPathChange,
  t,
  vaults,
}: Pick<QuickLauncherSettingsSectionProps,
  'captureFolder' | 'captureVaultPath' | 'onCaptureFolderChange' | 'onCaptureVaultPathChange' | 't' | 'vaults'>) {
  const folders = useCaptureFolders(captureVaultPath)
  const availableVaults = vaults.filter(availableVault)
  const selectVault = (value: string) => {
    onCaptureVaultPathChange(value === '__active__' ? '' : value)
    onCaptureFolderChange('')
  }
  return <>
    <SettingsRow label={t('settings.quickLauncher.defaultVault')} description={t('settings.quickLauncher.defaultVaultDescription')}>
      <SelectControl
        value={captureVaultPath || '__active__'}
        onValueChange={selectVault}
        options={[
          { value: '__active__', label: t('settings.quickLauncher.activeVault') },
          ...availableVaults.map((vault) => ({ value: vault.path, label: vault.label })),
        ]}
        testId="settings-quick-capture-vault"
        ariaLabel={t('settings.quickLauncher.defaultVault')}
      />
    </SettingsRow>
    <SettingsRow label={t('settings.quickLauncher.defaultFolder')} description={t('settings.quickLauncher.defaultFolderDescription')}>
      <SelectControl
        value={captureFolder || '__root__'}
        onValueChange={(value) => onCaptureFolderChange(value === '__root__' ? '' : value)}
        options={[
          { value: '__root__', label: t('quickLauncher.vaultRoot') },
          ...folders.map((folder) => ({ value: folder.path, label: folder.label })),
        ]}
        testId="settings-quick-capture-folder"
        ariaLabel={t('settings.quickLauncher.defaultFolder')}
      />
    </SettingsRow>
  </>
}

function QuickLauncherSettingsControls({
  captureFolder,
  captureOpenAfterSave,
  captureVaultPath,
  onCaptureFolderChange,
  onCaptureOpenAfterSaveChange,
  onCaptureVaultPathChange,
  onShortcutChange,
  shortcut,
  t,
  vaults,
}: QuickLauncherSettingsSectionProps) {
  return (
    <SettingsGroup>
      <ShortcutSettingsRow onShortcutChange={onShortcutChange} shortcut={shortcut} t={t} />
      <CaptureDestinationSettingsRows {...{ captureFolder, captureVaultPath, onCaptureFolderChange, onCaptureVaultPathChange, t, vaults }} />
      <SettingsSwitchRow
        label={t('settings.quickLauncher.openAfterSave')}
        description={t('settings.quickLauncher.openAfterSaveDescription')}
        checked={captureOpenAfterSave}
        onChange={onCaptureOpenAfterSaveChange}
        testId="settings-quick-capture-open-after-save"
      />
    </SettingsGroup>
  )
}

export function QuickLauncherSettingsSection({
  onChange,
  settings,
  t,
  vaults,
}: {
  onChange: QuickLauncherSettingsChange
  settings: QuickLauncherSettingsValue
  t: QuickLauncherSettingsSectionProps['t']
  vaults: readonly VaultOption[]
}) {
  return (
    <SettingsSection id={SETTINGS_SECTION_IDS.quickLauncher}>
      <SectionHeading
        icon={<Keyboard size={16} aria-hidden="true" />}
        title={t('settings.quickLauncher.title')}
      />
      <QuickLauncherSettingsControls
        captureFolder={settings.captureFolder}
        captureOpenAfterSave={settings.captureOpenAfterSave}
        captureVaultPath={settings.captureVaultPath}
        onCaptureFolderChange={(value) => onChange('captureFolder', value)}
        onCaptureOpenAfterSaveChange={(value) => onChange('captureOpenAfterSave', value)}
        onCaptureVaultPathChange={(value) => onChange('captureVaultPath', value)}
        onShortcutChange={(value) => onChange('shortcut', value)}
        shortcut={settings.shortcut}
        t={t}
        vaults={vaults}
      />
    </SettingsSection>
  )
}
