import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, Check, FolderOpen, GitBranch, Rocket, X } from 'lucide-react'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import type { VaultOption } from './types'
import { useDismissibleLayer } from './useDismissibleLayer'

interface VaultMenuProps {
  vaults: VaultOption[]
  vaultPath: string
  onSwitchVault: (path: string) => void
  onOpenLocalFolder?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onRemoveVault?: (path: string) => void
}

interface VaultMenuItemProps {
  vault: VaultOption
  isActive: boolean
  canRemove: boolean
  onSelect: () => void
  onRemove?: () => void
}

interface VaultMenuActionProps {
  icon: ReactNode
  label: string
  testId: string
  accent?: boolean
  onClick: () => void
}

interface VaultAction {
  key: string
  icon: ReactNode
  label: string
  testId: string
  accent?: boolean
  onClick: () => void
}

function buildVaultActions({
  onCloneGettingStarted,
  onCloneVault,
  onOpenLocalFolder,
}: Pick<VaultMenuProps, 'onCloneGettingStarted' | 'onCloneVault' | 'onOpenLocalFolder'>): VaultAction[] {
  const items: VaultAction[] = []

  if (onOpenLocalFolder) {
    items.push({
      key: 'open-local',
      icon: <FolderOpen size={12} />,
      label: 'Open local folder',
      testId: 'vault-menu-open-local',
      onClick: onOpenLocalFolder,
    })
  }

  if (onCloneVault) {
    items.push({
      key: 'clone-git',
      icon: <GitBranch size={12} />,
      label: 'Clone Git repo',
      testId: 'vault-menu-clone-git',
      onClick: onCloneVault,
    })
  }

  if (onCloneGettingStarted) {
    items.push({
      key: 'clone-getting-started',
      icon: <Rocket size={12} />,
      label: 'Clone Getting Started Vault',
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

function vaultItemStyle(isActive: boolean, unavailable: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 4,
    cursor: unavailable ? 'not-allowed' : 'pointer',
    background: isActive ? 'var(--hover)' : 'transparent',
    opacity: unavailable ? 0.45 : 1,
    color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
    fontSize: 12,
  }
}

function VaultMenuItem({ vault, isActive, canRemove, onSelect, onRemove }: VaultMenuItemProps) {
  const unavailable = vault.available === false
  const canHover = !isActive && !unavailable

  return (
    <div
      role="button"
      onClick={unavailable ? undefined : onSelect}
      style={{ ...vaultItemStyle(isActive, unavailable), justifyContent: 'space-between' }}
      title={unavailable ? `Vault not found: ${vault.path}` : vault.path}
      onMouseEnter={canHover ? (event) => { event.currentTarget.style.background = 'var(--hover)' } : undefined}
      onMouseLeave={canHover ? (event) => { event.currentTarget.style.background = 'transparent' } : undefined}
      data-testid={`vault-menu-item-${vault.label}`}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <VaultMenuIcon isActive={isActive} unavailable={unavailable} />
        {vault.label}
      </span>
      {canRemove && onRemove && (
        <span
          role="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            borderRadius: 3,
            cursor: 'pointer',
            opacity: 0.5,
          }}
          title="Remove from list"
          data-testid={`vault-menu-remove-${vault.label}`}
          onMouseEnter={(event) => {
            event.currentTarget.style.opacity = '1'
            event.currentTarget.style.background = 'var(--hover)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.opacity = '0.5'
            event.currentTarget.style.background = 'transparent'
          }}
        >
          <X size={10} />
        </span>
      )}
    </div>
  )
}

function VaultMenuAction({ icon, label, testId, accent = false, onClick }: VaultMenuActionProps) {
  return (
    <div
      role="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        background: 'transparent',
        color: accent ? 'var(--accent-blue)' : 'var(--muted-foreground)',
        fontSize: 12,
      }}
      onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
      onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
      data-testid={testId}
    >
      {icon}
      {label}
    </div>
  )
}

export function VaultMenu({
  vaults,
  vaultPath,
  onSwitchVault,
  onOpenLocalFolder,
  onCloneVault,
  onCloneGettingStarted,
  onRemoveVault,
}: VaultMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeVault = vaults.find((vault) => vault.path === vaultPath)
  const canRemove = !!onRemoveVault && vaults.length > 1

  useDismissibleLayer(open, menuRef, () => setOpen(false))

  const actions = useMemo<VaultAction[]>(() => {
    return buildVaultActions({
      onCloneGettingStarted,
      onCloneVault,
      onOpenLocalFolder,
    })
  }, [onCloneGettingStarted, onCloneVault, onOpenLocalFolder])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <ActionTooltip copy={{ label: 'Switch vault' }} side="top">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={open
            ? 'h-auto gap-1 rounded-sm bg-[var(--hover)] px-1 py-0.5 text-[11px] font-medium text-foreground hover:bg-[var(--hover)]'
            : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'}
          onClick={() => setOpen((value) => !value)}
          aria-label="Switch vault"
          data-testid="status-vault-trigger"
        >
          <FolderOpen size={13} />
          {activeVault?.label ?? 'Vault'}
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          {vaults.map((vault) => (
            <VaultMenuItem
              key={vault.path}
              vault={vault}
              isActive={vault.path === vaultPath}
              canRemove={canRemove}
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
              label={action.label}
              testId={action.testId}
              accent={action.accent}
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
