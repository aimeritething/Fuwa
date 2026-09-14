import { beforeEach, describe, expect, it, vi } from 'vitest'

const tauri = vi.hoisted(() => ({ isTauri: false, invoke: vi.fn(async () => undefined as unknown) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: (command: string, args?: Record<string, unknown>) => tauri.invoke(command, args) }))
vi.mock('@/platform/tauri', () => ({
  isTauri: () => tauri.isTauri,
  mockInvoke: (command: string, args?: Record<string, unknown>) => tauri.invoke(command, args),
}))

const { moveFileToFolder, moveFileToTrash, moveFolderToTrash, renameFile } = await import('./explorer-commands')

const FOLDER = '/Notes'

function lastCall() {
  return tauri.invoke.mock.calls.at(-1) as unknown as [string, Record<string, unknown>]
}

beforeEach(() => {
  vi.clearAllMocks()
  tauri.isTauri = false
})

describe('Move to Trash', () => {
  it('sends a Document or an Image file with the Folder it lives in', async () => {
    tauri.invoke.mockResolvedValue(`${FOLDER}/lake.png`)

    await moveFileToTrash({ folder: FOLDER, path: `${FOLDER}/lake.png` })

    expect(lastCall()).toEqual(['delete_note', { path: `${FOLDER}/lake.png`, vaultPath: FOLDER }])
  })

  it('sends a folder as a Folder-relative path', async () => {
    tauri.invoke.mockResolvedValue('Projects/Drafts')

    await moveFolderToTrash({ folder: FOLDER, path: `${FOLDER}/Projects/Drafts` })

    expect(lastCall()).toEqual(['delete_vault_folder', { vaultPath: FOLDER, folderPath: 'Projects/Drafts' }])
  })
})

describe('a drag-and-drop move', () => {
  it('answers with the new absolute path', async () => {
    tauri.invoke.mockResolvedValue({ new_path: `${FOLDER}/Projects/a.md` })

    const moved = await moveFileToFolder({ folder: FOLDER, path: `${FOLDER}/a.md`, destination: `${FOLDER}/Projects` })

    expect(moved).toBe(`${FOLDER}/Projects/a.md`)
    expect(lastCall()).toEqual(['move_note_to_folder', {
      vaultPath: FOLDER, oldPath: `${FOLDER}/a.md`, folderPath: 'Projects',
    }])
  })

  it('takes the Folder root as the empty relative path', async () => {
    tauri.invoke.mockResolvedValue({ new_path: `${FOLDER}/a.md` })

    await moveFileToFolder({ folder: FOLDER, path: `${FOLDER}/Projects/a.md`, destination: FOLDER })

    expect(lastCall()[1]).toMatchObject({ folderPath: '' })
  })
})

describe('the commands Rust takes as one struct', () => {
  it('wraps them under `args` for Tauri and keeps them flat for the fixture', async () => {
    tauri.invoke.mockResolvedValue({ new_path: `${FOLDER}/b.md` })
    tauri.isTauri = true

    await renameFile({ folder: FOLDER, path: `${FOLDER}/a.md`, stem: 'b' })

    expect(lastCall()).toEqual(['rename_vault_file', {
      args: { vaultPath: FOLDER, oldPath: `${FOLDER}/a.md`, newStem: 'b' },
    }])

    tauri.isTauri = false
    await renameFile({ folder: FOLDER, path: `${FOLDER}/a.md`, stem: 'b' })

    expect(lastCall()).toEqual(['rename_vault_file', {
      vaultPath: FOLDER, oldPath: `${FOLDER}/a.md`, newStem: 'b',
    }])
  })
})
