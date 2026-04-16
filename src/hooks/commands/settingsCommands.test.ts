import { describe, expect, it, vi } from 'vitest'
import { buildSettingsCommands } from './settingsCommands'

describe('buildSettingsCommands', () => {
  it('adds a discoverable H1 auto-rename settings command', () => {
    const onOpenSettings = vi.fn()

    const commands = buildSettingsCommands({ onOpenSettings })
    const command = commands.find((item) => item.id === 'open-h1-auto-rename-setting')

    expect(command).toMatchObject({
      label: 'Open H1 Auto-Rename Setting',
      enabled: true,
      group: 'Settings',
    })

    command?.execute()
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('keeps the general settings command available', () => {
    const onOpenSettings = vi.fn()

    const commands = buildSettingsCommands({ onOpenSettings })

    expect(commands.find((item) => item.id === 'open-settings')).toMatchObject({
      label: 'Open Settings',
      shortcut: '⌘,',
      enabled: true,
    })
  })
})
