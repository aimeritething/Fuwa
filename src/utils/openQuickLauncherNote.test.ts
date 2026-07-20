import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QUICK_LAUNCHER_OPEN_NOTE_EVENT } from '../lib/quickLauncherEvents'
import { openQuickLauncherNote } from './openQuickLauncherNote'

const mocks = vi.hoisted(() => ({ emitTo: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ emitTo: mocks.emitTo }))
vi.mock('../mock-tauri', () => ({ isTauri: () => true }))

describe('openQuickLauncherNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hands an exact cross-vault deep link to the main window', async () => {
    mocks.emitTo.mockResolvedValue(undefined)
    await openQuickLauncherNote({
      absolutePath: '/vault/folder/note.md',
      vaultPath: '/vault',
      vaults: [{ alias: 'work', available: true, path: '/vault' }],
    })

    expect(mocks.emitTo).toHaveBeenCalledWith('main', QUICK_LAUNCHER_OPEN_NOTE_EVENT, {
      url: 'tolaria://work/folder/note.md',
    })
  })

  it('rejects notes outside their claimed vault', async () => {
    await expect(openQuickLauncherNote({
      absolutePath: '/other/note.md',
      vaultPath: '/vault',
      vaults: [{ alias: 'work', available: true, path: '/vault' }],
    })).rejects.toThrow('outside_vault')
    expect(mocks.emitTo).not.toHaveBeenCalled()
  })
})
