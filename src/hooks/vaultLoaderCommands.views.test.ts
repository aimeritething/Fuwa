import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMountedVaultViews } from './vaultLoaderCommands'
import type { ViewDefinition } from '../types'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (command: string, args?: Record<string, unknown>) => mockInvoke(command, args),
}))

function viewDefinition(name: string): ViewDefinition {
  return {
    name,
    icon: null,
    color: null,
    sort: null,
    filters: { all: [] },
  }
}

describe('loadMountedVaultViews', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('loads saved views from every mounted vault with source workspace identity', async () => {
    mockInvoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command !== 'list_views') return Promise.resolve([])

      if (args?.vaultPath === '/personal') {
        return Promise.resolve([{ filename: 'focus.yml', definition: viewDefinition('Personal Focus') }])
      }
      if (args?.vaultPath === '/team') {
        return Promise.resolve([{ filename: 'focus.yml', definition: viewDefinition('Team Focus') }])
      }
      return Promise.resolve([])
    })

    const views = await loadMountedVaultViews({
      defaultWorkspacePath: '/personal',
      vaultPath: '/personal',
      vaults: [
        { label: 'Personal', path: '/personal', alias: 'personal', mounted: true, available: true },
        { label: 'Team', path: '/team', alias: 'team', mounted: true, available: true },
      ],
    })

    expect(views.map((view) => ({
      filename: view.filename,
      name: view.definition.name,
      rootPath: view.rootPath,
      workspacePath: view.workspace?.path,
    }))).toEqual([
      { filename: 'focus.yml', name: 'Personal Focus', rootPath: '/personal', workspacePath: '/personal' },
      { filename: 'focus.yml', name: 'Team Focus', rootPath: '/team', workspacePath: '/team' },
    ])
  })

  it('loads saved views from the default workspace even when stale state marks it unmounted', async () => {
    mockInvoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command !== 'list_views') return Promise.resolve([])

      if (args?.vaultPath === '/default') {
        return Promise.resolve([{ filename: 'default.yml', definition: viewDefinition('Default View') }])
      }
      if (args?.vaultPath === '/mounted') {
        return Promise.resolve([{ filename: 'mounted.yml', definition: viewDefinition('Mounted View') }])
      }
      throw new Error(`Unexpected vaultPath ${String(args?.vaultPath)}`)
    })

    const views = await loadMountedVaultViews({
      defaultWorkspacePath: '/default',
      vaultPath: '/default',
      vaults: [
        { label: 'Default', path: '/default', alias: 'default', mounted: false, available: true },
        { label: 'Mounted', path: '/mounted', alias: 'mounted', mounted: true, available: true },
        { label: 'Hidden', path: '/hidden', alias: 'hidden', mounted: false, available: true },
      ],
    })

    expect(views.map((view) => view.definition.name)).toEqual(['Default View', 'Mounted View'])
  })
})
