import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openTabFileInDefaultApp, revealTabFile } from './tab-file-actions'

const commands = vi.hoisted(() => ({
  revealPath: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  openPathInDefaultApp: vi.fn<(path: string, root: string) => Promise<void>>(() => Promise.resolve()),
}))

vi.mock('@/folder/explorer-commands', () => ({
  revealPath: (path: string) => commands.revealPath(path),
  openPathInDefaultApp: (path: string, root: string) => commands.openPathInDefaultApp(path, root),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the active Tab file hand-offs', () => {
  it('reveals the file itself in Finder', () => {
    revealTabFile('/n/Projects/Plumo.md')

    expect(commands.revealPath).toHaveBeenCalledWith('/n/Projects/Plumo.md')
  })

  it('opens a file inside the Folder with the Folder as its root', () => {
    openTabFileInDefaultApp('/n/Attachments/lake.png', '/n')

    expect(commands.openPathInDefaultApp).toHaveBeenCalledWith('/n/Attachments/lake.png', '/n')
  })

  it('opens a lone Document with its own directory as its root', () => {
    openTabFileInDefaultApp('/elsewhere/Loose.md', '/n')

    expect(commands.openPathInDefaultApp).toHaveBeenCalledWith('/elsewhere/Loose.md', '/elsewhere')
  })

  it('reports a refusal rather than throwing at the click', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    commands.openPathInDefaultApp.mockRejectedValueOnce(new Error('No app for image/png'))
    commands.revealPath.mockRejectedValueOnce(new Error('Path does not exist'))

    openTabFileInDefaultApp('/n/lake.png', '/n')
    revealTabFile('/n/gone.md')
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2))
    warn.mockRestore()
  })
})
