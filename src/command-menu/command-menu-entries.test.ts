import { describe, expect, it } from 'vitest'
import { commandMenuCommandEntries, commandMenuFileEntries, type CommandMenuState } from './command-menu-entries'
import type { ListedFile } from '@/folder/explorer'

const EVERYTHING: CommandMenuState = { hasDocument: true, hasFolder: true, hasTab: true }
const NOTHING: CommandMenuState = { hasDocument: false, hasFolder: false, hasTab: false }

const byId = (state: CommandMenuState) => new Map(commandMenuCommandEntries(state).map((entry) => [entry.id, entry]))

describe('commandMenuCommandEntries', () => {
  it('lists every native menu command in menu order, and nothing that has no menu item', () => {
    const entries = commandMenuCommandEntries(EVERYTHING)
    expect(entries.map((entry) => entry.name)).toEqual([
      'New Document', 'Open Folder…', 'Open Document…', 'Close Folder', 'Quick Open', 'Save', 'Close Tab',
      'Undo', 'Redo', 'Paste without Formatting', 'Find',
      'Toggle Sidebar', 'Toggle Rich/Raw', 'Appearance: System', 'Appearance: Dark', 'Appearance: Light',
      'Zoom In', 'Zoom Out', 'Actual Size',
      'Previous Tab', 'Next Tab',
      // The platform label: `Quit Fuwa` on macOS, `Quit` elsewhere (jsdom is elsewhere).
      expect.stringMatching(/^Quit/),
    ])
    expect(entries.every((entry) => entry.kind === 'command')).toBe(true)
    expect(entries.some((entry) => entry.id.startsWith('window-jump-to-tab'))).toBe(false)
  })

  it('leaves the Command Menu itself out: a palette row that reopens the palette is noise', () => {
    expect(byId(EVERYTHING).has('view-command-palette')).toBe(false)
  })

  it('names the menu each command lives in, and carries the shortcut display', () => {
    const entries = byId(EVERYTHING)
    expect(entries.get('file-save')).toMatchObject({ detail: 'File', shortcut: expect.stringMatching(/S$/) })
    expect(entries.get('view-appearance-dark')).toMatchObject({ detail: 'View', shortcut: undefined })
    expect(entries.get('app-quit')).toMatchObject({ detail: 'Fuwa', shortcut: expect.stringMatching(/Q$/) })
    expect(entries.get('file-close-vault')?.shortcut).toBeUndefined()
  })

  it('greys the state groups: no Document, no Tab, no Folder', () => {
    const entries = byId(NOTHING)
    for (const id of ['file-save', 'edit-toggle-raw-editor', 'edit-find-in-note', 'file-close-tab', 'file-new-note', 'file-quick-open', 'file-close-vault']) {
      expect(entries.get(id)?.enabled, id).toBe(false)
    }
    for (const id of ['file-open-vault', 'file-open-note', 'view-toggle-sidebar', 'app-quit', 'edit-undo']) {
      expect(entries.get(id)?.enabled, id).toBe(true)
    }
  })

  it('keeps Close Tab live over an Image Tab, where Save and Find are greyed', () => {
    const entries = byId({ hasDocument: false, hasFolder: true, hasTab: true })
    expect(entries.get('file-close-tab')?.enabled).toBe(true)
    expect(entries.get('file-save')?.enabled).toBe(false)
    expect(entries.get('edit-find-in-note')?.enabled).toBe(false)
  })
})

describe('commandMenuFileEntries', () => {
  const FOLDER = '/Users/fuwa/Documents/Notes'
  const listing: ListedFile[] = [
    { path: `${FOLDER}/Welcome.md`, kind: 'note', modifiedAt: 1, fileSize: 10 },
    { path: `${FOLDER}/Projects`, kind: 'folder', modifiedAt: 1, fileSize: 0 },
    { path: `${FOLDER}/Projects/Fuwa.md`, kind: 'note', modifiedAt: 1, fileSize: 10 },
    { path: `${FOLDER}/Attachments/lake.png`, kind: 'image', modifiedAt: 1, fileSize: 10 },
  ]

  it('turns Documents and Image files into rows, and skips folders', () => {
    expect(commandMenuFileEntries(listing, FOLDER)).toEqual([
      { kind: 'document', id: `${FOLDER}/Welcome.md`, name: 'Welcome.md', detail: 'Notes' },
      { kind: 'document', id: `${FOLDER}/Projects/Fuwa.md`, name: 'Fuwa.md', detail: 'Notes › Projects' },
      { kind: 'image', id: `${FOLDER}/Attachments/lake.png`, name: 'lake.png', detail: 'Notes › Attachments' },
    ])
  })

  it('has nothing to list with no Folder', () => {
    expect(commandMenuFileEntries(listing, null)).toEqual([])
  })
})
