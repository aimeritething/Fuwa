interface ShortcutKeyboardEvent {
  altKey: boolean
  code: string
  ctrlKey: boolean
  key: string
  metaKey: boolean
  shiftKey: boolean
}

function keyboardEventKey(event: ShortcutKeyboardEvent): string | null {
  if (event.code === 'Space') return 'Space'
  const codeMatch = event.code.match(/^(?:Key([A-Z])|Digit([0-9]))$/u)
  if (codeMatch) return codeMatch[1] ?? codeMatch[2] ?? null
  const functionKey = event.key.toUpperCase()
  return /^F([1-9]|1[0-2])$/u.test(functionKey) ? functionKey : null
}

function commandControlPressed(event: ShortcutKeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export function quickLauncherShortcutFromKeyboardEvent(event: ShortcutKeyboardEvent): string | null {
  const key = keyboardEventKey(event)
  if (!key) return null
  const modifiers = [
    { enabled: commandControlPressed(event), name: 'CommandOrControl' },
    { enabled: event.altKey, name: 'Alt' },
    { enabled: event.shiftKey, name: 'Shift' },
  ].filter((modifier) => modifier.enabled).map((modifier) => modifier.name)
  return modifiers.length > 0 ? [...modifiers, key].join('+') : null
}
