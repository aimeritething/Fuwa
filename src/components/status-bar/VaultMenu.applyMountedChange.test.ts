import { describe, expect, it, vi } from 'vitest'
import { applyMountedChange } from './vaultMenuMountedChange'
import type { VaultOption } from './types'

function vault(path: string, mounted = true): VaultOption {
  return { label: path, path, alias: path.replace('/', ''), mounted, available: true }
}

interface ChangeOverrides {
  defaultPath?: string
  vaultPath?: string
  path?: string
  mounted?: boolean
  includedVaults?: VaultOption[]
}

function callApply(overrides: ChangeOverrides) {
  const onSetDefaultWorkspace = vi.fn()
  const onSwitchVault = vi.fn()
  const onUpdateWorkspaceIdentity = vi.fn()
  applyMountedChange({
    defaultPath: overrides.defaultPath ?? '/a',
    vaultPath: overrides.vaultPath ?? '/a',
    includedVaults: overrides.includedVaults ?? [vault('/a'), vault('/b')],
    mounted: overrides.mounted ?? false,
    path: overrides.path ?? '/a',
    callbacks: { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity },
  })
  return { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity }
}

describe('applyMountedChange', () => {
  it('reroutes both the default workspace and the active vault when the unmounted vault is both', () => {
    const { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity } = callApply({
      defaultPath: '/a',
      vaultPath: '/a',
      path: '/a',
    })

    expect(onSetDefaultWorkspace).toHaveBeenCalledWith('/b')
    expect(onSwitchVault).toHaveBeenCalledWith('/b')
    expect(onUpdateWorkspaceIdentity).toHaveBeenCalledWith('/a', { mounted: false })
  })

  it('reroutes the active vault when only the active vault is unmounted (default workspace differs)', () => {
    const { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity } = callApply({
      defaultPath: '/b',
      vaultPath: '/a',
      path: '/a',
    })

    expect(onSetDefaultWorkspace).not.toHaveBeenCalled()
    expect(onSwitchVault).toHaveBeenCalledWith('/b')
    expect(onUpdateWorkspaceIdentity).toHaveBeenCalledWith('/a', { mounted: false })
  })

  it('reroutes the default workspace when only the default is unmounted (active vault differs)', () => {
    const { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity } = callApply({
      defaultPath: '/a',
      vaultPath: '/b',
      path: '/a',
    })

    expect(onSetDefaultWorkspace).toHaveBeenCalledWith('/b')
    expect(onSwitchVault).not.toHaveBeenCalled()
    expect(onUpdateWorkspaceIdentity).toHaveBeenCalledWith('/a', { mounted: false })
  })

  it('does not reroute when the unmounted vault is neither default nor active', () => {
    const { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity } = callApply({
      defaultPath: '/a',
      vaultPath: '/a',
      path: '/b',
      includedVaults: [vault('/a'), vault('/b'), vault('/c')],
    })

    expect(onSetDefaultWorkspace).not.toHaveBeenCalled()
    expect(onSwitchVault).not.toHaveBeenCalled()
    expect(onUpdateWorkspaceIdentity).toHaveBeenCalledWith('/b', { mounted: false })
  })

  it('bails out without changing anything when no alternative mounted vault exists', () => {
    const { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity } = callApply({
      defaultPath: '/a',
      vaultPath: '/a',
      path: '/a',
      includedVaults: [vault('/a')],
    })

    expect(onSetDefaultWorkspace).not.toHaveBeenCalled()
    expect(onSwitchVault).not.toHaveBeenCalled()
    expect(onUpdateWorkspaceIdentity).not.toHaveBeenCalled()
  })

  it('only marks the vault unmounted (no reroute) when remounting', () => {
    const { onSetDefaultWorkspace, onSwitchVault, onUpdateWorkspaceIdentity } = callApply({
      defaultPath: '/a',
      vaultPath: '/a',
      path: '/b',
      mounted: true,
    })

    expect(onSetDefaultWorkspace).not.toHaveBeenCalled()
    expect(onSwitchVault).not.toHaveBeenCalled()
    expect(onUpdateWorkspaceIdentity).toHaveBeenCalledWith('/b', { mounted: true })
  })
})
