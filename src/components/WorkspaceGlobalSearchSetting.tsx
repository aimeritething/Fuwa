import { createTranslator, type AppLocale } from '../lib/i18n'
import type { VaultOption } from './status-bar/types'
import { Switch } from './ui/switch'

interface WorkspaceGlobalSearchSettingProps {
  locale: AppLocale
  onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  vault: VaultOption
}

export function WorkspaceGlobalSearchSetting({
  locale,
  onUpdateWorkspaceIdentity,
  vault,
}: WorkspaceGlobalSearchSettingProps) {
  const t = createTranslator(locale)
  const label = t('settings.workspaces.globalSearch')
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-muted/30 px-3 py-2">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{t('settings.workspaces.globalSearchDescription')}</span>
      </span>
      <Switch
        checked={vault.searchEnabled !== false}
        disabled={!onUpdateWorkspaceIdentity}
        onCheckedChange={(searchEnabled) => onUpdateWorkspaceIdentity?.(vault.path, { searchEnabled })}
        aria-label={label}
      />
    </div>
  )
}
