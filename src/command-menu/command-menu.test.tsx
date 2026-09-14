import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandMenu, type CommandMenuProps } from './command-menu'
import type { CommandMenuEntry } from './command-menu-matcher'

const ENTRIES: CommandMenuEntry[] = [
  { kind: 'command', id: 'file-save', name: 'Save', detail: 'File', shortcut: '⌘S', enabled: false },
  { kind: 'command', id: 'view-toggle-sidebar', name: 'Toggle Sidebar', detail: 'View', shortcut: '⌘[' },
  { kind: 'command', id: 'edit-toggle-raw-editor', name: 'Toggle Rich/Raw', detail: 'View', shortcut: '⌘\\' },
  { kind: 'document', id: '/Notes/Projects/Fuwa.md', name: 'Fuwa.md', detail: 'Notes › Projects' },
  { kind: 'document', id: '/Notes/Welcome.md', name: 'Welcome.md', detail: 'Notes' },
  { kind: 'image', id: '/Notes/Attachments/lake.png', name: 'lake.png', detail: 'Notes › Attachments' },
]

function renderMenu(overrides: Partial<CommandMenuProps> = {}) {
  const props: CommandMenuProps = {
    open: true,
    mode: 'commands',
    entries: ENTRIES,
    onClose: vi.fn(),
    onRunCommand: vi.fn(),
    onOpenFile: vi.fn(),
    ...overrides,
  }
  const view = render(<CommandMenu {...props} />)
  return { ...view, props }
}

const rows = () => screen.getAllByTestId('command-menu-row')
const rowNames = () => rows().map((row) => within(row).getByTestId('command-menu-row-name').textContent)
const input = () => screen.getByRole('combobox')
const activeRow = () => screen.getByRole('option', { selected: true })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CommandMenu', () => {
  it('opens on the input with every command listed and the mono footer', () => {
    renderMenu()
    expect(screen.getByTestId('command-menu')).toHaveAttribute('data-mode', 'commands')
    expect(input()).toHaveFocus()
    expect(rowNames()).toEqual(['Save', 'Toggle Sidebar', 'Toggle Rich/Raw'])
    expect(screen.getByTestId('command-menu-footer')).toHaveTextContent('↵ open · ⌘↵ open in Raw · esc close')
  })

  it('renders nothing while closed', () => {
    renderMenu({ open: false })
    expect(screen.queryByTestId('command-menu')).toBeNull()
  })

  it('shows the type column, the muted detail and the shortcut on each row', () => {
    renderMenu()
    const [save] = rows()
    expect(within(save).getByTestId('command-menu-row-type')).toHaveTextContent('Command')
    expect(within(save).getByTestId('command-menu-row-detail')).toHaveTextContent('File')
    expect(within(save).getByTestId('command-menu-row-shortcut')).toHaveTextContent('⌘S')
    expect(save).toHaveAttribute('aria-disabled', 'true')
  })

  it('typing matches commands and files together and emphasises the matched substring', () => {
    renderMenu()
    fireEvent.change(input(), { target: { value: 'tog' } })
    expect(rowNames()).toEqual(['Toggle Sidebar', 'Toggle Rich/Raw'])
    expect(within(rows()[0]).getByTestId('command-menu-row-name').querySelector('mark')).toHaveTextContent('Tog')

    fireEvent.change(input(), { target: { value: 'fuwa' } })
    const [fuwa] = rows()
    expect(within(fuwa).getByTestId('command-menu-row-type')).toHaveTextContent('Document')
    expect(within(fuwa).getByTestId('command-menu-row-detail')).toHaveTextContent('Notes › Projects')

    fireEvent.change(input(), { target: { value: 'lake' } })
    expect(within(rows()[0]).getByTestId('command-menu-row-type')).toHaveTextContent('Image')
  })

  it('Quick Open mode lists files only and never a command', () => {
    renderMenu({ mode: 'files' })
    expect(screen.getByTestId('command-menu')).toHaveAttribute('data-mode', 'files')
    expect(rowNames()).toEqual(['Fuwa.md', 'lake.png', 'Welcome.md'])

    fireEvent.change(input(), { target: { value: 'tog' } })
    expect(screen.queryAllByTestId('command-menu-row')).toEqual([])
    expect(screen.getByTestId('command-menu-empty')).toHaveTextContent('No matches')
  })

  it('↓ and ↑ move the selection, wrapping at both ends, and ↵ runs the selected command', () => {
    const { props } = renderMenu()
    expect(activeRow()).toHaveTextContent('Save')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(activeRow()).toHaveTextContent('Toggle Sidebar')
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect(activeRow()).toHaveTextContent('Toggle Rich/Raw')

    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(props.onRunCommand).toHaveBeenCalledWith('edit-toggle-raw-editor')
    expect(props.onOpenFile).not.toHaveBeenCalled()
  })

  it('↵ on a greyed command does nothing', () => {
    const { props } = renderMenu()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(props.onRunCommand).not.toHaveBeenCalled()
  })

  it('↵ opens the selected file, ⌘↵ opens a Document in Raw and an Image file plainly', () => {
    const { props } = renderMenu({ mode: 'files' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(props.onOpenFile).toHaveBeenLastCalledWith('/Notes/Projects/Fuwa.md', { raw: false })

    fireEvent.keyDown(input(), { key: 'Enter', metaKey: true })
    expect(props.onOpenFile).toHaveBeenLastCalledWith('/Notes/Projects/Fuwa.md', { raw: true })

    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter', metaKey: true })
    expect(props.onOpenFile).toHaveBeenLastCalledWith('/Notes/Attachments/lake.png', { raw: false })
  })

  it('a click opens the row under the pointer, and hovering moves the selection', () => {
    const { props } = renderMenu({ mode: 'files' })
    const welcome = rows()[2]
    fireEvent.mouseMove(welcome)
    expect(activeRow()).toHaveTextContent('Welcome.md')
    fireEvent.click(welcome)
    expect(props.onOpenFile).toHaveBeenCalledWith('/Notes/Welcome.md', { raw: false })
  })

  it('typing resets the selection to the best match', () => {
    renderMenu()
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.change(input(), { target: { value: 'w' } })
    expect(activeRow()).toHaveTextContent('Welcome.md')
  })

  it('esc closes', () => {
    const { props } = renderMenu()
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('is marked as the palette, which the plain-text paste helper keeps out of', () => {
    renderMenu()
    expect(screen.getByTestId('command-menu')).toHaveAttribute('data-command-palette', 'true')
  })
})
