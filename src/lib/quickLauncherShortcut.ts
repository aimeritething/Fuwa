export const DEFAULT_QUICK_LAUNCHER_SHORTCUT = 'CommandOrControl+Alt+T'

interface ShortcutAdapter {
  register: (shortcut: string, handler: () => void) => Promise<void>
  unregister: (shortcut: string) => Promise<void>
}

interface ReplaceShortcutInput {
  adapter: ShortcutAdapter
  handler: () => void
  shortcut: string
}

export type ReplaceShortcutResult =
  | { activeShortcut: string; ok: true }
  | { activeShortcut: string | null; error: string; ok: false }

let activeShortcut: string | null = null

const MODIFIER_ALIASES = new Map([
  ['cmdorctrl', 'CommandOrControl'],
  ['commandorcontrol', 'CommandOrControl'],
  ['cmd', 'Command'],
  ['command', 'Command'],
  ['ctrl', 'Control'],
  ['control', 'Control'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
])

function normalizedKey(value: string): string | null {
  const key = value.trim()
  if (!key) return null
  if (key.toLowerCase() === 'space') return 'Space'
  if (/^[a-z0-9]$/iu.test(key)) return key.toUpperCase()
  return /^(F([1-9]|1[0-2]))$/iu.test(key) ? key.toUpperCase() : null
}

export function normalizeQuickLauncherShortcut(value: string | null | undefined): string | null {
  if (!value) return null
  const pieces = value.split('+').map((piece) => piece.trim()).filter(Boolean)
  if (pieces.length < 2) return null
  const key = normalizedKey(pieces.at(-1) ?? '')
  if (!key) return null

  const modifiers = pieces.slice(0, -1).map((piece) => MODIFIER_ALIASES.get(piece.toLowerCase()))
  if (modifiers.some((modifier) => !modifier)) return null
  const uniqueModifiers = [...new Set(modifiers as string[])]
  if (uniqueModifiers.length === 0) return null
  return [...uniqueModifiers, key].join('+')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function restorePreviousShortcut(
  adapter: ShortcutAdapter,
  handler: () => void,
  previousShortcut: string | null,
): Promise<string | null> {
  if (!previousShortcut) return null
  try {
    await adapter.register(previousShortcut, handler)
    return previousShortcut
  } catch {
    return null
  }
}

export async function replaceQuickLauncherShortcut({
  adapter,
  handler,
  shortcut,
}: ReplaceShortcutInput): Promise<ReplaceShortcutResult> {
  const normalized = normalizeQuickLauncherShortcut(shortcut)
  if (!normalized) return { ok: false, activeShortcut, error: 'Invalid shortcut' }
  if (normalized === activeShortcut) return { ok: true, activeShortcut: normalized }

  const previousShortcut = activeShortcut
  if (previousShortcut) await adapter.unregister(previousShortcut)
  try {
    await adapter.register(normalized, handler)
    activeShortcut = normalized
    return { ok: true, activeShortcut: normalized }
  } catch (error) {
    activeShortcut = await restorePreviousShortcut(adapter, handler, previousShortcut)
    return { ok: false, activeShortcut, error: errorMessage(error) }
  }
}

export function resetQuickLauncherShortcutStateForTests(): void {
  activeShortcut = null
}
