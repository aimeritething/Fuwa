import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, FolderOpen, GitBranch, Plus, Rocket, Settings2, X } from 'lucide-react'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import { trackEvent } from '../../lib/telemetry'
import type { VaultOption } from './types'
import { useDismissibleLayer } from './useDismissibleLayer'
import { WORKSPACE_COLORS, workspaceIdentityFromVault } from '../../utils/workspaces'

interface VaultMenuProps {
  vaults: VaultOption[]
  vaultPath: string
  onSwitchVault: (path: string) => void
  onOpenLocalFolder?: () => void
  onCreateEmptyVault?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onRemoveVault?: (path: string) => void
  defaultWorkspacePath?: string | null
  onSetDefaultWorkspace?: (path: string) => void
  onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  compact?: boolean
  locale?: AppLocale
}

interface VaultMenuItemProps {
  vault: VaultOption
  isActive: boolean
  canRemove: boolean
  locale: AppLocale
  onSelect: () => void
  onRemove?: () => void
}

interface VaultMenuActionProps {
  icon: ReactNode
  labelKey: TranslationKey
  testId: string
  accent?: boolean
  onClick: () => void
}

interface WorkspaceManagerProps {
  defaultWorkspacePath?: string | null
  locale: AppLocale
  onOpenChange: (open: boolean) => void
  onSetDefaultWorkspace?: (path: string) => void
  onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  open: boolean
  vaults: VaultOption[]
}

interface WorkspaceRowProps extends Pick<
  WorkspaceManagerProps,
  'defaultWorkspacePath' | 'locale' | 'onSetDefaultWorkspace' | 'onUpdateWorkspaceIdentity'
> {
  vault: VaultOption
}

interface VaultAction {
  key: string
  icon: ReactNode
  labelKey: TranslationKey
  testId: string
  accent?: boolean
  onClick: () => void
}

function getVaultTriggerClassName(open: boolean, compact: boolean) {
  if (compact) {
    return open
      ? 'h-6 w-6 rounded-sm bg-[var(--hover)] p-0 text-foreground hover:bg-[var(--hover)]'
      : 'h-6 w-6 rounded-sm p-0 text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
  }

  return open
    ? 'h-auto gap-1 rounded-sm bg-[var(--hover)] px-1 py-0.5 text-[12px] font-medium text-foreground hover:bg-[var(--hover)]'
    : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
}

function buildVaultActions({
  onManageWorkspaces,
  onCreateEmptyVault,
  onCloneGettingStarted,
  onCloneVault,
  onOpenLocalFolder,
}: Pick<VaultMenuProps, 'onCreateEmptyVault' | 'onCloneGettingStarted' | 'onCloneVault' | 'onOpenLocalFolder'> & {
  onManageWorkspaces?: () => void
}): VaultAction[] {
  const items: VaultAction[] = []

  if (onManageWorkspaces) {
    items.push({
      key: 'manage-workspaces',
      icon: <Settings2 size={12} />,
      labelKey: 'status.vault.manageWorkspaces',
      testId: 'vault-menu-manage-workspaces',
      accent: true,
      onClick: onManageWorkspaces,
    })
  }

  if (onCreateEmptyVault) {
    items.push({
      key: 'create-empty',
      icon: <Plus size={12} />,
      labelKey: 'status.vault.createEmpty',
      testId: 'vault-menu-create-empty',
      accent: true,
      onClick: onCreateEmptyVault,
    })
  }

  if (onOpenLocalFolder) {
    items.push({
      key: 'open-local',
      icon: <FolderOpen size={12} />,
      labelKey: 'status.vault.openLocal',
      testId: 'vault-menu-open-local',
      onClick: onOpenLocalFolder,
    })
  }

  if (onCloneVault) {
    items.push({
      key: 'clone-git',
      icon: <GitBranch size={12} />,
      labelKey: 'status.vault.cloneGit',
      testId: 'vault-menu-clone-git',
      onClick: onCloneVault,
    })
  }

  if (onCloneGettingStarted) {
    items.push({
      key: 'clone-getting-started',
      icon: <Rocket size={12} />,
      labelKey: 'status.vault.cloneGettingStarted',
      testId: 'vault-menu-clone-getting-started',
      accent: true,
      onClick: onCloneGettingStarted,
    })
  }

  return items
}

function VaultMenuIcon({ isActive, unavailable }: { isActive: boolean; unavailable: boolean }) {
  if (isActive) return <Check size={12} />
  if (unavailable) return <AlertTriangle size={12} style={{ color: 'var(--muted-foreground)' }} />
  return <span style={{ width: 12 }} />
}

function VaultMenuItem({ vault, isActive, canRemove, locale, onSelect, onRemove }: VaultMenuItemProps) {
  const unavailable = vault.available === false
  const removeLabel = translate(locale, 'status.vault.remove', { label: vault.label })
  const itemClassName = [
    'w-full justify-start rounded-sm px-2 py-1 text-xs font-normal',
    canRemove ? 'pr-7' : '',
    isActive
      ? 'text-foreground hover:bg-[var(--hover)] hover:text-foreground'
      : 'text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground',
  ].filter(Boolean).join(' ')

  return (
    <div className="group relative flex w-full items-center rounded-sm">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={unavailable}
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        title={unavailable ? translate(locale, 'status.vault.notFound', { path: vault.path }) : vault.path}
        data-testid={`vault-menu-item-${vault.label}`}
        className={itemClassName}
        style={{
          height: 'auto',
          background: isActive ? 'var(--hover)' : 'transparent',
          opacity: unavailable ? 0.45 : 1,
        }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <VaultMenuIcon isActive={isActive} unavailable={unavailable} />
          <span className="truncate">{vault.label}</span>
        </span>
      </Button>
      {canRemove && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          title={removeLabel}
          aria-label={removeLabel}
          data-testid={`vault-menu-remove-${vault.label}`}
          className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm text-muted-foreground opacity-0 pointer-events-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:pointer-events-auto group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
        >
          <X size={10} />
        </Button>
      )}
    </div>
  )
}

function VaultMenuAction({ icon, labelKey, testId, accent = false, onClick, locale = 'en' }: VaultMenuActionProps & { locale?: AppLocale }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      className="h-auto w-full justify-start rounded-sm px-2 py-1 text-xs font-normal"
      style={{ color: accent ? 'var(--accent-blue)' : 'var(--muted-foreground)' }}
      data-testid={testId}
    >
      {icon}
      {translate(locale, labelKey)}
    </Button>
  )
}

function WorkspaceColorButton({
  color,
  selected,
  onSelect,
}: {
  color: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="h-5 w-5 rounded-sm p-0"
      style={{
        background: selected ? `var(--accent-${color})` : 'transparent',
        border: `1px solid var(--accent-${color})`,
      }}
      aria-label={color}
      onClick={onSelect}
    />
  )
}

function workspaceBadgeClassName(): string {
  return 'inline-flex h-5 min-w-6 items-center justify-center rounded-sm px-1 text-[10px] font-semibold text-white'
}

function WorkspaceBadge({ workspace }: { workspace: ReturnType<typeof workspaceIdentityFromVault> }) {
  return (
    <span
      className={workspaceBadgeClassName()}
      style={{ background: workspace.color ? `var(--accent-${workspace.color})` : 'var(--muted-foreground)' }}
    >
      {workspace.shortLabel}
    </span>
  )
}

function WorkspaceHeader({
  locale,
  onSetDefaultWorkspace,
  vault,
  workspace,
}: Pick<WorkspaceRowProps, 'locale' | 'onSetDefaultWorkspace' | 'vault'> & {
  workspace: ReturnType<typeof workspaceIdentityFromVault>
}) {
  const handleSetDefaultWorkspace = () => {
    onSetDefaultWorkspace?.(vault.path)
    trackEvent('workspace_default_changed', { workspace_alias: workspace.alias })
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <WorkspaceBadge workspace={workspace} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{workspace.label}</div>
          <div className="truncate text-[11px] text-muted-foreground">{workspace.path}</div>
        </div>
      </div>
      <Button
        type="button"
        variant={workspace.defaultForNewNotes ? 'secondary' : 'ghost'}
        size="xs"
        onClick={handleSetDefaultWorkspace}
        disabled={!onSetDefaultWorkspace || workspace.defaultForNewNotes}
        data-testid={`workspace-default-${workspace.alias}`}
      >
        {workspace.defaultForNewNotes
          ? translate(locale, 'workspace.manager.default')
          : translate(locale, 'workspace.manager.makeDefault')}
      </Button>
    </div>
  )
}

function WorkspaceMountedControl({
  canEdit,
  locale,
  onUpdateWorkspaceIdentity,
  vault,
  workspace,
}: Pick<WorkspaceRowProps, 'locale' | 'onUpdateWorkspaceIdentity' | 'vault'> & {
  canEdit: boolean
  workspace: ReturnType<typeof workspaceIdentityFromVault>
}) {
  const handleMountedChange = (mounted: boolean) => {
    onUpdateWorkspaceIdentity?.(vault.path, { mounted })
    trackEvent('workspace_mount_changed', { workspace_alias: workspace.alias, mounted: mounted ? 1 : 0 })
  }

  return (
    <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{translate(locale, 'workspace.manager.mounted')}</span>
      <Switch
        checked={workspace.mounted}
        onCheckedChange={(mounted) => canEdit && handleMountedChange(mounted)}
        disabled={!canEdit}
        aria-label={translate(locale, 'workspace.manager.mounted')}
      />
    </label>
  )
}

function WorkspaceIdentityInputs({
  canEdit,
  locale,
  onUpdateWorkspaceIdentity,
  vault,
  workspace,
}: Pick<WorkspaceRowProps, 'locale' | 'onUpdateWorkspaceIdentity' | 'vault'> & {
  canEdit: boolean
  workspace: ReturnType<typeof workspaceIdentityFromVault>
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,0.5fr)] gap-2">
      <Input
        value={vault.label}
        onChange={(event) => canEdit && onUpdateWorkspaceIdentity?.(vault.path, { label: event.target.value })}
        aria-label={translate(locale, 'workspace.manager.label')}
        disabled={!canEdit}
      />
      <Input
        value={vault.alias ?? workspace.alias}
        onChange={(event) => canEdit && onUpdateWorkspaceIdentity?.(vault.path, { alias: event.target.value })}
        aria-label={translate(locale, 'workspace.manager.alias')}
        disabled={!canEdit}
      />
    </div>
  )
}

function WorkspaceColorPicker({
  canEdit,
  onUpdateWorkspaceIdentity,
  vault,
}: Pick<WorkspaceRowProps, 'onUpdateWorkspaceIdentity' | 'vault'> & {
  canEdit: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {WORKSPACE_COLORS.map((color) => (
        <WorkspaceColorButton
          key={color}
          color={color}
          selected={(vault.color ?? null) === color}
          onSelect={() => canEdit && onUpdateWorkspaceIdentity?.(vault.path, { color })}
        />
      ))}
    </div>
  )
}

function WorkspaceRow({
  defaultWorkspacePath,
  locale,
  onSetDefaultWorkspace,
  onUpdateWorkspaceIdentity,
  vault,
}: WorkspaceRowProps) {
  const workspace = workspaceIdentityFromVault(vault, { defaultWorkspacePath })
  const canEdit = !!onUpdateWorkspaceIdentity && vault.path !== '' && !vault.managedDefault

  return (
    <div
      className="grid gap-2 rounded-md border border-border p-3"
      data-testid={`workspace-row-${workspace.alias}`}
    >
      <WorkspaceHeader locale={locale} onSetDefaultWorkspace={onSetDefaultWorkspace} vault={vault} workspace={workspace} />
      <WorkspaceMountedControl canEdit={canEdit} locale={locale} onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity} vault={vault} workspace={workspace} />
      <WorkspaceIdentityInputs canEdit={canEdit} locale={locale} onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity} vault={vault} workspace={workspace} />
      <WorkspaceColorPicker canEdit={canEdit} onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity} vault={vault} />
    </div>
  )
}

function WorkspaceManager({
  defaultWorkspacePath,
  locale,
  onOpenChange,
  onSetDefaultWorkspace,
  onUpdateWorkspaceIdentity,
  open,
  vaults,
}: WorkspaceManagerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-[720px]" data-testid="workspace-manager-dialog">
        <DialogHeader>
          <DialogTitle>{translate(locale, 'workspace.manager.title')}</DialogTitle>
          <DialogDescription>{translate(locale, 'workspace.manager.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {vaults.map((vault) => (
            <WorkspaceRow
              key={vault.path}
              defaultWorkspacePath={defaultWorkspacePath}
              locale={locale}
              onSetDefaultWorkspace={onSetDefaultWorkspace}
              onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
              vault={vault}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function VaultMenu(props: VaultMenuProps) {
  const {
    vaults, vaultPath, onSwitchVault, onOpenLocalFolder, onCreateEmptyVault,
    onCloneVault, onCloneGettingStarted, onRemoveVault, defaultWorkspacePath,
    onSetDefaultWorkspace, onUpdateWorkspaceIdentity, compact = false, locale = 'en',
  } = props
  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeVault = vaults.find((vault) => vault.path === vaultPath)
  const canRemove = !!onRemoveVault && vaults.length > 1
  const triggerClassName = getVaultTriggerClassName(open, compact)
  const triggerSize = compact ? 'icon-xs' : 'xs'
  const activeVaultLabel = activeVault?.label ?? translate(locale, 'status.vault.default')

  useDismissibleLayer(open, menuRef, () => setOpen(false))

  const actions = useMemo<VaultAction[]>(() => {
    return buildVaultActions({
      onManageWorkspaces: () => {
        setManageOpen(true)
        trackEvent('workspace_manager_opened', { workspace_count: vaults.length })
      },
      onCreateEmptyVault,
      onCloneGettingStarted,
      onCloneVault,
      onOpenLocalFolder,
    })
  }, [onCreateEmptyVault, onCloneGettingStarted, onCloneVault, onOpenLocalFolder, vaults.length])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <WorkspaceManager
        defaultWorkspacePath={defaultWorkspacePath}
        locale={locale}
        onOpenChange={setManageOpen}
        onSetDefaultWorkspace={onSetDefaultWorkspace}
        onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
        open={manageOpen}
        vaults={vaults}
      />
      <ActionTooltip copy={{ label: translate(locale, 'status.vault.switch') }} side="top">
        <Button
          type="button"
          variant="ghost"
          size={triggerSize}
          className={triggerClassName}
          onClick={() => setOpen((value) => !value)}
          aria-label={translate(locale, 'status.vault.switch')}
          data-testid="status-vault-trigger"
        >
          <FolderOpen size={13} />
          {compact ? null : <span className="max-w-32 truncate">{activeVaultLabel}</span>}
        </Button>
      </ActionTooltip>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: 'var(--sidebar)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 4,
            minWidth: 200,
            boxShadow: '0 4px 12px var(--shadow-dialog)',
            zIndex: 1000,
          }}
        >
          {vaults.map((vault) => (
            <VaultMenuItem
              key={vault.path}
              vault={vault}
              isActive={vault.path === vaultPath}
              canRemove={canRemove}
              locale={locale}
              onSelect={() => {
                onSwitchVault(vault.path)
                setOpen(false)
              }}
              onRemove={onRemoveVault ? () => {
                onRemoveVault(vault.path)
                setOpen(false)
              } : undefined}
            />
          ))}
          {actions.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
          {actions.map((action) => (
            <VaultMenuAction
              key={action.key}
              icon={action.icon}
              labelKey={action.labelKey}
              testId={action.testId}
              accent={action.accent}
              locale={locale}
              onClick={() => {
                action.onClick()
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
