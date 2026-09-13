import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pickNoteToOpen } from './noteOpenDialog'

const runtime = vi.hoisted(() => ({
  inTauri: false,
  open: vi.fn<(options: Record<string, unknown>) => Promise<string | string[] | null>>(),
  dialogSelections: [] as string[],
}))

vi.mock('@/platform/tauri', () => ({
  isTauri: () => runtime.inTauri,
  getMockVault: () => ({
    takeDialogSelection: () => runtime.dialogSelections.shift() ?? null,
  }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (options: Record<string, unknown>) => runtime.open(options),
}))

describe('pickNoteToOpen', () => {
  beforeEach(() => {
    runtime.inTauri = false
    runtime.open.mockReset()
    runtime.dialogSelections = []
  })

  it('outside Tauri answers from the fixture\'s queued dialog selections', async () => {
    runtime.dialogSelections = ['/Users/fuwa/Documents/Notes/Welcome.md']

    await expect(pickNoteToOpen()).resolves.toBe('/Users/fuwa/Documents/Notes/Welcome.md')
    await expect(pickNoteToOpen()).resolves.toBeNull()
    expect(runtime.open).not.toHaveBeenCalled()
  })

  it('in Tauri opens the system file dialog filtered to .md and returns the chosen path', async () => {
    runtime.inTauri = true
    runtime.open.mockResolvedValue('/Users/me/Notes/Plan.md')

    await expect(pickNoteToOpen()).resolves.toBe('/Users/me/Notes/Plan.md')

    expect(runtime.open).toHaveBeenCalledWith(expect.objectContaining({
      multiple: false,
      directory: false,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    }))
  })

  it('in Tauri reports a cancelled dialog as null', async () => {
    runtime.inTauri = true
    runtime.open.mockResolvedValue(null)

    await expect(pickNoteToOpen()).resolves.toBeNull()
  })
})
