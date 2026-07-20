import type { Settings } from '../types'
import { DEFAULT_QUICK_LAUNCHER_SHORTCUT } from './quickLauncherShortcut'

export interface QuickLauncherSettingsValue {
  captureFolder: string
  captureOpenAfterSave: boolean
  captureVaultPath: string
  shortcut: string
}

export type QuickLauncherSettingsChange = <Key extends keyof QuickLauncherSettingsValue>(
  key: Key,
  value: QuickLauncherSettingsValue[Key],
) => void

export function quickLauncherSettingsValue(settings: Settings): QuickLauncherSettingsValue {
  return {
    shortcut: settings.quick_launcher_shortcut ?? DEFAULT_QUICK_LAUNCHER_SHORTCUT,
    captureVaultPath: settings.quick_capture_vault_path ?? '',
    captureFolder: settings.quick_capture_folder ?? '',
    captureOpenAfterSave: settings.quick_capture_open_after_save === true,
  }
}

export function quickLauncherSettingsPatch(value: QuickLauncherSettingsValue): Partial<Settings> {
  return {
    quick_launcher_shortcut: value.shortcut || null,
    quick_capture_vault_path: value.captureVaultPath || null,
    quick_capture_folder: value.captureFolder || null,
    quick_capture_open_after_save: value.captureOpenAfterSave,
  }
}
