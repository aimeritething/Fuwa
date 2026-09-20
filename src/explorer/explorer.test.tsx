import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Explorer } from './explorer'
import { useExplorerMemory } from './use-explorer-memory'
import { buildExplorerTree, type ListedFile } from '@/folder/explorer'
import type { ExplorerActions } from './use-explorer-actions'

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
    trash: vi.fn(),
    moveInto: vi.fn(),
    reveal: vi.fn(),
    copyPath: vi.fn(),
    ...overrides,
  }
}

interface HarnessProps {
  actions: ExplorerActions
  onOpenFile?: (path: string) => void
  folder?: string
  tree?: ReturnType<typeof buildExplorerTree>
  /** False stands in for the collapsed sidebar: the Explorer is unmounted, what holds its memory is not. */
  shown?: boolean
}

/** The Explorer under what App gives it: its memory, held above the sidebar. */
function ExplorerHarness({ actions, onOpenFile = vi.fn(), folder = FOLDER, tree = TREE, shown = true }: HarnessProps) {
  const memory = useExplorerMemory(folder)
  if (!shown) return null
  return (
    <Explorer
      folder={folder}
      tree={tree}
      activeTabPath={null}
      onOpenFile={onOpenFile}
      actions={actions}
      memory={memory}
      onCloseFolder={vi.fn()}
      onOpenFolder={vi.fn()}
    />
  )
}

function renderExplorer(actions: ExplorerActions, onOpenFile = vi.fn()) {
  const view = render(<ExplorerHarness actions={actions} onOpenFile={onOpenFile} />)
  const rerender = (props: Partial<HarnessProps>) => view.rerender(<ExplorerHarness actions={actions} onOpenFile={onOpenFile} {...props} />)
  return { onOpenFile, rerender }
}

describe('the empty states', () => {
  function renderWithoutFolder(error: string | null = null) {
    const onOpenFolder = vi.fn()
    function NoFolderHarness() {
      const memory = useExplorerMemory(null)
      return (
        <Explorer folder={null} tree={null} activeTabPath={null} onOpenFile={vi.fn()} actions={stubActions()}
          memory={memory} onCloseFolder={vi.fn()} onOpenFolder={onOpenFolder} error={error} />
      )
    }
    render(<NoFolderHarness />)
    return { onOpenFolder }
  }

  it('with no Folder open says so under Explorer, with the Open Folder button and the drop hint', () => {
    const { onOpenFolder } = renderWithoutFolder()

    const block = screen.getByTestId('explorer-no-folder')
    expect(block).toHaveTextContent('No folder open')
    expect(block).toHaveTextContent('or drop a .md file onto the window')
    expect(screen.queryByTestId('explorer-folder-missing')).toBeNull()
    expect(screen.queryByRole('tree')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder ⌘O' }))
    expect(onOpenFolder).toHaveBeenCalledTimes(1)
  })

  it('names the Folder that was not found above the button on a restore that lost it', () => {
    renderWithoutFolder('Folder not found: /Users/x/Gone')

    const block = screen.getByTestId('explorer-no-folder')
    const missing = screen.getByTestId('explorer-folder-missing')
    expect(missing).toHaveTextContent('Folder not found: /Users/x/Gone')
    const button = screen.getByRole('button', { name: 'Open Folder ⌘O' })
    expect(missing.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(block).toContainElement(missing)
  })

  it('shows one muted line in the tree area while the Folder holds no Document, and nothing once it does', () => {
    const emptyTree = buildExplorerTree(FOLDER, [listed('Attachments', 'folder'), listed('Attachments/lake.png', 'image')])
    const { rerender } = renderExplorer(stubActions())
    rerender({ tree: emptyTree })

    expect(screen.getByRole('tree')).toContainElement(screen.getByTestId('explorer-no-documents'))
    expect(screen.getByTestId('explorer-no-documents')).toHaveTextContent('No documents yet · ⌘N')
    expect(screen.queryByRole('button', { name: /Open Folder/ })).toBeNull()

    rerender({ tree: TREE })
    expect(screen.queryByTestId('explorer-no-documents')).toBeNull()
  })
})

/** Radix opens a context menu from a right-click on its trigger. */
function rightClick(element: Element) {
  fireEvent.contextMenu(element, { button: 2, clientX: 20, clientY: 20 })
}

function menuLabels(menu: HTMLElement): string[] {
  return within(menu).getAllByRole('menuitem').map((item) => item.textContent ?? '')
}

describe('the context menu', () => {
  it('gives a Document its own items', async () => {
    renderExplorer(stubActions())

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`))

    const menu = await screen.findByTestId('explorer-menu:note')
    expect(menuLabels(menu)).toEqual(['Rename…', 'Move to Trash', 'Reveal in Finder', 'Copy Path'])
    expect(within(menu).getByText('Move to Trash')).not.toHaveAttribute('data-disabled')
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

  // Right-click leaves the selection where it was, so the row the menu acts on
  // has to say so itself: it keeps the hover look, not the selected one.
  it('marks the row its menu is open on, and only while it is open', async () => {
    renderExplorer(stubActions({ selected: `${FOLDER}/Welcome.md` }))
    const row = screen.getByTestId(`explorer-row:${FOLDER}/Projects`)
    expect(row).toHaveClass('data-[state=open]:bg-sidebar-row-hover')
    expect(row).not.toHaveAttribute('data-state', 'open')

    rightClick(row)
    const menu = await screen.findByTestId('explorer-menu:folder')
    expect(row).toHaveAttribute('data-state', 'open')
    expect(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`)).not.toHaveAttribute('data-state', 'open')

    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(row).not.toHaveAttribute('data-state', 'open'))
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

  it.each([
    { name: 'while composing', init: { isComposing: true } },
    { name: 'ending a composition (keyCode 229)', init: { keyCode: 229 } },
  ])('leaves Enter and Escape to the input method $name', async ({ init }) => {
    const actions = stubActions({ editing })
    renderExplorer(actions)

    const input = screen.getByTestId('explorer-rename-input')
    fireEvent.change(input, { target: { value: 'wendang' } })
    expect(fireEvent.keyDown(input, { key: 'Enter', ...init })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'Escape', ...init })).toBe(true)

    await Promise.resolve()
    expect(actions.commitRename).not.toHaveBeenCalled()
    expect(actions.cancelRename).not.toHaveBeenCalled()
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
    expect(screen.getByTestId('explorer-rename-input')).toHaveAttribute('aria-invalid', 'true')
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

/** jsdom has no DataTransfer, and a protected one answers `getData` with '' anyway. */
function dataTransfer(readable = true) {
  const held: Record<string, string> = {}
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (type: string, value: string) => { held[type] = value },
    getData: (type: string) => (readable ? held[type] ?? '' : ''),
  }
}

/** The tree opens with only the root expanded, so nested rows are revealed first. */
function expandProjects() {
  fireEvent.click(screen.getByLabelText('Expand Projects'))
}

describe('Move to Trash', () => {
  it('trashes the row under the cursor, with its kind', async () => {
    const trash = vi.fn()
    renderExplorer(stubActions({ trash }))

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Projects`))
    const menu = await screen.findByTestId('explorer-menu:folder')
    fireEvent.click(within(menu).getByText('Move to Trash'))

    await waitFor(() => expect(trash).toHaveBeenCalledWith(`${FOLDER}/Projects`, 'folder'))
  })

  it('trashes an Image file as a file', async () => {
    const trash = vi.fn()
    renderExplorer(stubActions({ trash }))
    expandProjects()

    rightClick(screen.getByTestId(`explorer-row:${FOLDER}/Projects/lake.png`))
    const menu = await screen.findByTestId('explorer-menu:image')
    fireEvent.click(within(menu).getByText('Move to Trash'))

    await waitFor(() => expect(trash).toHaveBeenCalledWith(`${FOLDER}/Projects/lake.png`, 'image'))
  })
})

describe('drag-and-drop', () => {
  it('lets a Document and an Image file be dragged, and never a folder or the root', () => {
    renderExplorer(stubActions())
    expandProjects()

    expect(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`)).toHaveAttribute('draggable', 'true')
    expect(screen.getByTestId(`explorer-row:${FOLDER}/Projects/lake.png`)).toHaveAttribute('draggable', 'true')
    expect(screen.getByTestId(`explorer-row:${FOLDER}/Projects`)).not.toHaveAttribute('draggable', 'true')
    expect(screen.getByTestId(`explorer-row:${FOLDER}`)).not.toHaveAttribute('draggable', 'true')
  })

  it('moves the dragged file into the folder row it is dropped on', () => {
    const moveInto = vi.fn()
    renderExplorer(stubActions({ moveInto }))
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`), { dataTransfer: transfer })
    const target = screen.getByTestId(`explorer-row:${FOLDER}/Projects`)
    fireEvent.dragOver(target, { dataTransfer: transfer })
    expect(target).toHaveAttribute('data-drop-target')
    fireEvent.drop(target, { dataTransfer: transfer })

    expect(moveInto).toHaveBeenCalledWith(`${FOLDER}/Welcome.md`, `${FOLDER}/Projects`)
    expect(target).not.toHaveAttribute('data-drop-target')
  })

  it('moves it to the Folder root when the root row takes the drop', () => {
    const moveInto = vi.fn()
    renderExplorer(stubActions({ moveInto }))
    expandProjects()
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByTestId(`explorer-row:${FOLDER}/Projects/Fuwa.md`), { dataTransfer: transfer })
    fireEvent.drop(screen.getByTestId(`explorer-row:${FOLDER}`), { dataTransfer: transfer })

    expect(moveInto).toHaveBeenCalledWith(`${FOLDER}/Projects/Fuwa.md`, FOLDER)
  })

  it('reads the dragged path from the drag in progress when the browser hides the data', () => {
    const moveInto = vi.fn()
    renderExplorer(stubActions({ moveInto }))
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`), { dataTransfer: transfer })
    fireEvent.drop(screen.getByTestId(`explorer-row:${FOLDER}/Projects`), { dataTransfer: dataTransfer(false) })

    expect(moveInto).toHaveBeenCalledWith(`${FOLDER}/Welcome.md`, `${FOLDER}/Projects`)
  })

  it('takes no drop on a Document row, and none with nothing being dragged', () => {
    const moveInto = vi.fn()
    renderExplorer(stubActions({ moveInto }))
    expandProjects()
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`), { dataTransfer: transfer })
    fireEvent.drop(screen.getByTestId(`explorer-row:${FOLDER}/Projects/Fuwa.md`), { dataTransfer: transfer })
    expect(moveInto).not.toHaveBeenCalled()

    fireEvent.dragEnd(screen.getByTestId(`explorer-row:${FOLDER}/Welcome.md`), { dataTransfer: transfer })
    const target = screen.getByTestId(`explorer-row:${FOLDER}/Projects`)
    fireEvent.dragOver(target, { dataTransfer: dataTransfer(false) })
    expect(target).not.toHaveAttribute('data-drop-target')
    fireEvent.drop(target, { dataTransfer: dataTransfer(false) })
    expect(moveInto).not.toHaveBeenCalled()
  })
})

const viewport = () => screen.getByRole('tree').querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
const isExpanded = (name: string) => screen.getByRole('treeitem', { name }).getAttribute('aria-expanded') === 'true'

describe('collapsing and expanding the sidebar', () => {
  it('keeps the folders that were opened and the scroll position', () => {
    const { rerender } = renderExplorer(stubActions())
    fireEvent.click(screen.getByLabelText('Expand Projects'))
    viewport().scrollTop = 120
    fireEvent.scroll(viewport())

    rerender({ shown: false })
    expect(screen.queryByRole('tree')).toBeNull()
    rerender({ shown: true })

    expect(isExpanded('Projects')).toBe(true)
    expect(viewport().scrollTop).toBe(120)
  })

  it('keeps a folder shut that holds the selected Document', () => {
    const actions = stubActions({ selected: `${FOLDER}/Projects/Fuwa.md` })
    const { rerender } = renderExplorer(actions)
    expect(isExpanded('Projects')).toBe(true)
    fireEvent.click(screen.getByLabelText('Collapse Projects'))

    rerender({ shown: false })
    rerender({ shown: true })

    expect(isExpanded('Projects')).toBe(false)
  })

  it('starts fresh in another Folder', () => {
    const { rerender } = renderExplorer(stubActions())
    fireEvent.click(screen.getByLabelText('Expand Projects'))
    viewport().scrollTop = 120
    fireEvent.scroll(viewport())

    const other = '/Other'
    const otherTree = buildExplorerTree(other, [
      { path: `${other}/Projects`, kind: 'folder', modifiedAt: null, fileSize: 0 },
      { path: `${other}/Projects/Plan.md`, kind: 'note', modifiedAt: null, fileSize: 0 },
    ])
    rerender({ folder: other, tree: otherTree })

    expect(isExpanded('Projects')).toBe(false)
    expect(viewport().scrollTop).toBe(0)
  })
})

describe('bringing a row into view', () => {
  const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView)
  beforeEach(() => scrollIntoView.mockClear())

  it('opens the folders above a newly selected Document and scrolls to its row, once', () => {
    const view = render(<ExplorerHarness actions={stubActions()} />)
    scrollIntoView.mockClear()

    view.rerender(<ExplorerHarness actions={stubActions({ selected: `${FOLDER}/Projects/Fuwa.md` })} />)

    expect(isExpanded('Projects')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('treeitem', { name: 'Fuwa.md' }))
  })

  it('waits for a row that is not listed yet', () => {
    const actions = stubActions({ selected: `${FOLDER}/Later.md` })
    const { rerender } = renderExplorer(actions)
    expect(scrollIntoView).not.toHaveBeenCalled()

    rerender({ tree: buildExplorerTree(FOLDER, [listed('Welcome.md', 'note'), listed('Later.md', 'note')]) })

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('stays put when a folder is opened or shut', () => {
    renderExplorer(stubActions({ selected: `${FOLDER}/Welcome.md` }))
    scrollIntoView.mockClear()

    fireEvent.click(screen.getByLabelText('Expand Projects'))
    fireEvent.click(screen.getByLabelText('Collapse Projects'))

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('stays put when the watcher hands over a new tree', () => {
    const { rerender } = renderExplorer(stubActions({ selected: `${FOLDER}/Welcome.md` }))
    scrollIntoView.mockClear()

    rerender({ tree: buildExplorerTree(FOLDER, [listed('Welcome.md', 'note'), listed('Added elsewhere.md', 'note')]) })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('stays put when the sidebar comes back with the same row selected', () => {
    const { rerender } = renderExplorer(stubActions({ selected: `${FOLDER}/Welcome.md` }))
    scrollIntoView.mockClear()

    rerender({ shown: false })
    rerender({ shown: true })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls to the row that enters rename, and not back to the selected row when the rename ends', () => {
    const selected = `${FOLDER}/Welcome.md`
    const view = render(<ExplorerHarness actions={stubActions({ selected })} />)
    scrollIntoView.mockClear()

    const editing = { path: `${FOLDER}/Projects/Fuwa.md`, kind: 'note' as const, stem: 'Fuwa', extension: '.md' }
    view.rerender(<ExplorerHarness actions={stubActions({ selected, editing })} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    view.rerender(<ExplorerHarness actions={stubActions({ selected })} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
