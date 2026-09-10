import { describe, expect, it } from 'vitest'
import { createMockVault, MOCK_VAULT_PATH, type MockVaultFile } from './vaultFixture'

const seed: MockVaultFile[] = [
  { path: `${MOCK_VAULT_PATH}/Welcome.md`, kind: 'note', content: '# Welcome\n', modifiedAt: 10, fileSize: 10 },
  { path: `${MOCK_VAULT_PATH}/Projects`, kind: 'folder', modifiedAt: 10, fileSize: 0 },
  { path: `${MOCK_VAULT_PATH}/Projects/Plan.md`, kind: 'note', content: '# Plan\n', modifiedAt: 11, fileSize: 7 },
  { path: `${MOCK_VAULT_PATH}/Projects/Archive`, kind: 'folder', modifiedAt: 10, fileSize: 0 },
  { path: `${MOCK_VAULT_PATH}/Attachments`, kind: 'folder', modifiedAt: 10, fileSize: 0 },
  { path: `${MOCK_VAULT_PATH}/Attachments/photo.png`, kind: 'image', modifiedAt: 12, fileSize: 2048 },
]

describe('createMockVault', () => {
  it('answers list_files with every seeded entry as path, kind, modifiedAt and fileSize', async () => {
    const vault = createMockVault(seed)

    const files = await vault.invoke('list_files', { vaultPath: MOCK_VAULT_PATH })

    expect(files).toEqual(seed.map(({ path, kind, modifiedAt, fileSize }) => ({ path, kind, modifiedAt, fileSize })))
  })

  it('rejects list_files for any root other than the mock Folder', async () => {
    const vault = createMockVault(seed)

    await expect(vault.invoke('list_files', { vaultPath: '/elsewhere' })).rejects.toThrow('Active vault is not available')
  })

  it('round-trips Document content through get and save and refreshes the listing', async () => {
    const vault = createMockVault(seed)
    const path = `${MOCK_VAULT_PATH}/Welcome.md`

    await expect(vault.invoke('get_note_content', { path })).resolves.toBe('# Welcome\n')
    await vault.invoke('save_note_content', { path, content: '# Welcome\n\nEdited.\n' })

    await expect(vault.invoke('get_note_content', { path })).resolves.toBe('# Welcome\n\nEdited.\n')
    const files = await vault.invoke('list_files', { vaultPath: MOCK_VAULT_PATH })
    const welcome = files.find((file) => file.path === path)
    expect(welcome?.fileSize).toBe('# Welcome\n\nEdited.\n'.length)
    expect(welcome?.modifiedAt).toBeGreaterThan(10)
  })

  it('creates a Document on save when the path is new and rejects paths outside the Folder', async () => {
    const vault = createMockVault(seed)
    const created = `${MOCK_VAULT_PATH}/Projects/New.md`

    await vault.invoke('save_note_content', { path: created, content: 'fresh\n' })

    await expect(vault.invoke('get_note_content', { path: created })).resolves.toBe('fresh\n')
    await expect(vault.invoke('get_note_content', { path: `${MOCK_VAULT_PATH}/missing.md` })).rejects.toThrow('File does not exist')
    await expect(vault.invoke('save_note_content', { path: '/outside/note.md', content: '' })).rejects.toThrow(
      'Path must stay inside the active vault',
    )
  })

  it('answers list_vault_folders with a sorted tree of Folder-relative paths', async () => {
    const vault = createMockVault(seed)

    const folders = await vault.invoke('list_vault_folders', { path: MOCK_VAULT_PATH })

    expect(folders).toEqual([
      { name: 'Attachments', path: 'Attachments', children: [] },
      { name: 'Projects', path: 'Projects', children: [{ name: 'Archive', path: 'Projects/Archive', children: [] }] },
    ])
  })

  it('tracks the watcher root across start and stop', async () => {
    const vault = createMockVault(seed)

    expect(vault.watchedPath()).toBeNull()
    await vault.invoke('start_vault_watcher', { path: MOCK_VAULT_PATH })
    expect(vault.watchedPath()).toBe(MOCK_VAULT_PATH)
    await vault.invoke('stop_vault_watcher')
    expect(vault.watchedPath()).toBeNull()
  })

  it('drains pending opens on take_pending_open', async () => {
    const vault = createMockVault(seed)
    vault.queuePendingOpen([`${MOCK_VAULT_PATH}/Welcome.md`])

    await expect(vault.invoke('take_pending_open')).resolves.toEqual([`${MOCK_VAULT_PATH}/Welcome.md`])
    await expect(vault.invoke('take_pending_open')).resolves.toEqual([])
  })

  it('records every invocation so specs can assert on the command boundary', async () => {
    const vault = createMockVault(seed)

    await vault.invoke('take_pending_open')
    await vault.invoke('get_note_content', { path: `${MOCK_VAULT_PATH}/Welcome.md` })

    expect(vault.calls).toEqual([
      { command: 'take_pending_open', args: undefined },
      { command: 'get_note_content', args: { path: `${MOCK_VAULT_PATH}/Welcome.md` } },
    ])
  })

  it('writes a Document directly without logging a command', async () => {
    const vault = createMockVault(seed)
    const path = `${MOCK_VAULT_PATH}/Direct.md`

    vault.writeNote(path, 'direct\n')

    expect(vault.calls).toEqual([])
    await expect(vault.invoke('get_note_content', { path })).resolves.toBe('direct\n')
    expect(() => vault.writeNote('/outside/note.md', '')).toThrow('Path must stay inside the active vault')
  })

  it('refuses to turn a folder or an Image file into a Document', async () => {
    const vault = createMockVault(seed)

    await expect(vault.invoke('save_note_content', { path: `${MOCK_VAULT_PATH}/Projects`, content: '' })).rejects.toThrow(
      'Path is not a note',
    )
    expect(() => vault.writeNote(`${MOCK_VAULT_PATH}/Attachments/photo.png`, '')).toThrow('Path is not a note')
  })

  it('creates the ancestor folders of seeded and saved paths implicitly', async () => {
    const vault = createMockVault([
      { path: `${MOCK_VAULT_PATH}/Projects/Archive/Old.md`, kind: 'note', content: '', modifiedAt: 5, fileSize: 0 },
    ])
    await vault.invoke('save_note_content', { path: `${MOCK_VAULT_PATH}/Inbox/Today.md`, content: 'x' })

    const files = await vault.invoke('list_files', { vaultPath: MOCK_VAULT_PATH })
    expect(files.filter((entry) => entry.kind === 'folder').map((entry) => entry.path)).toEqual([
      `${MOCK_VAULT_PATH}/Projects`,
      `${MOCK_VAULT_PATH}/Projects/Archive`,
      `${MOCK_VAULT_PATH}/Inbox`,
    ])
    await expect(vault.invoke('list_vault_folders', { path: MOCK_VAULT_PATH })).resolves.toEqual([
      { name: 'Inbox', path: 'Inbox', children: [] },
      { name: 'Projects', path: 'Projects', children: [{ name: 'Archive', path: 'Projects/Archive', children: [] }] },
    ])
  })

  it('rejects commands it does not answer and resets to the seed', async () => {
    const vault = createMockVault(seed)
    await vault.invoke('save_note_content', { path: `${MOCK_VAULT_PATH}/Welcome.md`, content: 'changed' })

    await expect(vault.invoke('delete_note', { path: 'x' })).rejects.toThrow('No mock handler for command: delete_note')

    vault.reset()
    expect(vault.calls).toEqual([])
    await expect(vault.invoke('get_note_content', { path: `${MOCK_VAULT_PATH}/Welcome.md` })).resolves.toBe('# Welcome\n')
  })
})
