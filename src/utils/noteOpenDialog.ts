import { getMockVault, isTauri } from '../mock-tauri'

/**
 * File → Open Document…: the system file dialog, filtered to `.md`. The
 * dialog is a plugin call rather than a command, so outside Tauri the Folder
 * fixture stands in for it with the selection a spec queued.
 */
export async function pickNoteToOpen(): Promise<string | null> {
  if (!isTauri()) return getMockVault().takeDialogSelection()

  const { open } = await import('@tauri-apps/plugin-dialog')
  const selection = await open({
    title: 'Open Document',
    multiple: false,
    directory: false,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  return typeof selection === 'string' ? selection : null
}
