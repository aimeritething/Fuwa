import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Explorer } from './Explorer'
import { buildExplorerTree, type ListedFile } from '../utils/explorer'
import type { ExplorerActions } from '../hooks/useExplorerActions'

const FOLDER = '/Notes'

function listed(relativePath: string, kind: ListedFile['kind']): ListedFile {
  return { path: `${FOLDER}/${relativePath}`, kind, modifiedAt: null, fileSize: 0 }
}

const TREE = buildExplorerTree(FOLDER, [
  listed('Welcome.md', 'note'),
  listed('Projects', 'folder'),
  listed('Projects/Fuwa.md', 'note'),
  listed('Projects/lake.png', 'image'),
])

function stubActions(overrides: Partial<ExplorerActions> = {}): ExplorerActions {
  return {
    selected: null,
    select: vi.fn(),
    editing: null,
    error: null,
    createDocument: vi.fn(),
    createFolder: vi.fn(),
    createDocumentIn: vi.fn(),
    createFolderIn: vi.fn(),
    startRename: vi.fn(),
    commitRename: vi.fn(async () => true),
    cancelRename: vi.fn(),
    reveal: vi.fn(),
    copyPath: vi.fn(),
    ...overrides,
  }
}

function renderExplorer(actions: ExplorerActions, onOpenFile = vi.fn()) {
  render(
    <Explorer
      folder={FOLDER}
      tree={TREE}
      activeTabPath={null}
      onOpenFile={onOpenFile}
      actions={actions}
      onCloseFolder={vi.fn()}
    />,
  )
  return { onOpenFile }
}

/** Radix opens a context menu from a right-click on its trigger. */
function rightClick(element: Element) {
  fireEvent.contextMenu(element, { button: 2, clientX: 20, clientY: 20 })
}

function menuLabels(menu: HTMLElement): string[] {
  return within(menu).getAllByRole('menuitem').map((item) => item.textContent ?? '')
}

describe('the context menu', () => {
  it('gives a Document its own items and leaves Move to Trash for AIM-390', async () => {
    renderExplorer(stubActions())

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`))

    const menu = await screen.findByTestId('explorer-menu:note')
    expect(menuLabels(menu)).toEqual(['Rename…', 'Move to Trash', 'Reveal in Finder', 'Copy Path'])
    expect(within(menu).getByText('Move to Trash')).toHaveAttribute('data-disabled')
  })

  it('gives a folder the creation items as well', async () => {
    renderExplorer(stubActions())

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Projects`))

    const menu = await screen.findByTestId('explorer-menu:folder')
    expect(menuLabels(menu)).toEqual([
      'New Document', 'New Folder', 'Rename…', 'Move to Trash', 'Reveal in Finder', 'Copy Path',
    ])
  })

  it('gives the root row no rename and no trash', async () => {
    renderExplorer(stubActions())

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}`))

    const menu = await screen.findByTestId('explorer-menu:root')
    expect(menuLabels(menu)).toEqual(['New Document', 'New Folder', 'Reveal in Finder', 'Copy Path'])
  })

  it('gives the area below the tree the two creation items, at the Folder root', async () => {
    const actions = stubActions()
    renderExplorer(actions)

    rightClick(screen.getByTestId('explorer-empty-area'))

    const menu = await screen.findByTestId('explorer-menu:empty')
    expect(menuLabels(menu)).toEqual(['New Document', 'New Folder'])
    fireEvent.click(within(menu).getByText('New Document'))
    await waitFor(() => expect(actions.createDocumentIn).toHaveBeenCalledWith(FOLDER))
  })

  it('changes neither the selection nor the active Tab', async () => {
    const actions = stubActions()
    const { onOpenFile } = renderExplorer(actions)

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`))
    await screen.findByTestId('explorer-menu:note')

    expect(actions.select).not.toHaveBeenCalled()
    expect(onOpenFile).not.toHaveBeenCalled()
  })

  it('starts the rename on the row under the cursor', async () => {
    const actions = stubActions()
    renderExplorer(actions)

    fireEvent.click(screen.getByLabelText('Expand Projects'))
    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Projects/lake.png`))
    const menu = await screen.findByTestId('explorer-menu:image')
    fireEvent.click(within(menu).getByText('Rename…'))

    await waitFor(() => expect(actions.startRename).toHaveBeenCalledWith(`${FOLDER}/Projects/lake.png`, 'image'))
  })

  it('hands Reveal in Finder and Copy Path the row it was opened on', async () => {
    const actions = stubActions()
    renderExplorer(actions)

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`))
    const menu = await screen.findByTestId('explorer-menu:note')
    fireEvent.click(within(menu).getByText('Copy Path'))

    await waitFor(() => expect(actions.copyPath).toHaveBeenCalledWith(`${FOLDER}/Welcome.md`))
  })
})

describe('the inline rename input', () => {
  const editing = {
    path: `${FOLDER}/Welcome.md`,
    kind: 'note' as const,
    stem: 'Welcome',
    extension: '.md',
  }

  it('offers the stem selected, with the extension as static text beside it', () => {
    renderExplorer(stubActions({ editing }))

    const input = screen.getByTestId('explorer-rename-input') as HTMLInputElement
    expect(input.value).toBe('Welcome')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('Welcome'.length)
    expect(screen.getByText('.md')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Welcome.md')).toBeNull()
  })

  it('drops a slash as it is typed', () => {
    renderExplorer(stubActions({ editing }))

    const input = screen.getByTestId('explorer-rename-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Notes/Q3' } })

    expect(input.value).toBe('NotesQ3')
  })

  it('commits on Enter', async () => {
    const actions = stubActions({ editing })
    renderExplorer(actions)

    const input = screen.getByTestId('explorer-rename-input')
    fireEvent.change(input, { target: { value: 'Readme' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(actions.commitRename).toHaveBeenCalledWith('Readme'))
  })

  it('cancels on Escape', () => {
    const actions = stubActions({ editing })
    renderExplorer(actions)

    fireEvent.keyDown(screen.getByTestId('explorer-rename-input'), { key: 'Escape' })

    expect(actions.cancelRename).toHaveBeenCalled()
    expect(actions.commitRename).not.toHaveBeenCalled()
  })

  it('commits on blur', async () => {
    const actions = stubActions({ editing })
    renderExplorer(actions)

    const input = screen.getByTestId('explorer-rename-input')
    fireEvent.change(input, { target: { value: 'Readme' } })
    fireEvent.blur(input)

    await waitFor(() => expect(actions.commitRename).toHaveBeenCalledWith('Readme'))
  })

  it('shows the refusal under the row and rings the input', () => {
    renderExplorer(stubActions({ editing, error: 'A Document named Readme.md already exists' }))

    expect(screen.getByTestId('explorer-rename-error'))
      .toHaveTextContent('A Document named Readme.md already exists')
    expect(screen.getByTestId('explorer-rename-input')).toHaveAttribute('data-invalid')
  })

  it('replaces only the row it is editing', () => {
    renderExplorer(stubActions({ editing }))

    expect(screen.queryByTestId(`explorer-row:${FOLDER}/Welcome.md`)).toBeNull()
    expect(screen.getByTestId(`explorer-row:${FOLDER}/Projects`)).toBeInTheDocument()
  })
})

describe('the header actions', () => {
  it('makes a new Document where the selection points', () => {
    const actions = stubActions()
    renderExplorer(actions)

    fireEvent.click(screen.getByTestId('explorer-new-document'))

    expect(actions.createDocument).toHaveBeenCalled()
  })

  it('holds exactly New Folder, Collapse All, Reveal in Finder and Close Folder', async () => {
    renderExplorer(stubActions())

    fireEvent.pointerDown(
      screen.getByTestId('explorer-more-actions'),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    )

    const menu = await screen.findByTestId('explorer-header-menu')
    expect(menuLabels(menu)).toEqual(['New Folder', 'Collapse All', 'Reveal in Finder', 'Close Folder'])
  })
})
