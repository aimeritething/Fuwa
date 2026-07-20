import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_QUICK_LAUNCHER_SHORTCUT,
  normalizeQuickLauncherShortcut,
  replaceQuickLauncherShortcut,
  resetQuickLauncherShortcutStateForTests,
} from './quickLauncherShortcut'
import { quickLauncherShortcutFromKeyboardEvent } from './quickLauncherShortcutRecorder'

const register = vi.fn().mockResolvedValue(undefined)
const unregister = vi.fn().mockResolvedValue(undefined)
const adapter = { register, unregister }
const handler = vi.fn()

describe('quick launcher global shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQuickLauncherShortcutStateForTests()
  })

  it('normalizes the portable default and rejects modifier-free shortcuts', () => {
    expect(DEFAULT_QUICK_LAUNCHER_SHORTCUT).toBe('CommandOrControl+Alt+T')
    expect(normalizeQuickLauncherShortcut(' cmdOrCtrl + option + t ')).toBe(DEFAULT_QUICK_LAUNCHER_SHORTCUT)
    expect(normalizeQuickLauncherShortcut('Space')).toBeNull()
    expect(normalizeQuickLauncherShortcut('CommandOrControl+Shift')).toBeNull()
  })

  it('records a portable shortcut from a keyboard event', () => {
    expect(quickLauncherShortcutFromKeyboardEvent({
      altKey: false,
      code: 'KeyK',
      ctrlKey: false,
      key: 'k',
      metaKey: true,
      shiftKey: true,
    })).toBe('CommandOrControl+Shift+K')
  })

  it('registers once and retains a working shortcut when replacement conflicts', async () => {
    expect(await replaceQuickLauncherShortcut({
      adapter,
      handler,
      shortcut: DEFAULT_QUICK_LAUNCHER_SHORTCUT,
    })).toEqual({ ok: true, activeShortcut: DEFAULT_QUICK_LAUNCHER_SHORTCUT })

    register.mockRejectedValueOnce(new Error('Shortcut already registered'))
    expect(await replaceQuickLauncherShortcut({
      adapter,
      handler,
      shortcut: 'CommandOrControl+Alt+Space',
    })).toEqual({
      ok: false,
      activeShortcut: DEFAULT_QUICK_LAUNCHER_SHORTCUT,
      error: 'Shortcut already registered',
    })

    expect(unregister).toHaveBeenCalledWith(DEFAULT_QUICK_LAUNCHER_SHORTCUT)
    expect(register).toHaveBeenLastCalledWith(DEFAULT_QUICK_LAUNCHER_SHORTCUT, handler)
  })

  it('does not unregister or register again when the active shortcut is unchanged', async () => {
    await replaceQuickLauncherShortcut({ adapter, handler, shortcut: DEFAULT_QUICK_LAUNCHER_SHORTCUT })
    vi.clearAllMocks()

    expect(await replaceQuickLauncherShortcut({ adapter, handler, shortcut: DEFAULT_QUICK_LAUNCHER_SHORTCUT }))
      .toEqual({ ok: true, activeShortcut: DEFAULT_QUICK_LAUNCHER_SHORTCUT })
    expect(register).not.toHaveBeenCalled()
    expect(unregister).not.toHaveBeenCalled()
  })
})
