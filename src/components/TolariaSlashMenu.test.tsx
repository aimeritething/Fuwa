import { fireEvent, render, screen } from '@testing-library/react'
import type { MouseEventHandler, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const editorElement = document.createElement('div')

vi.mock('@blocknote/react', () => ({
  useBlockNoteEditor: () => ({ domElement: editorElement }),
  useComponentsContext: () => ({
    SuggestionMenu: {
      EmptyItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Item: ({ item, onClick, onMouseEnter }: {
        item: { title: string }
        onClick: () => void
        onMouseEnter?: MouseEventHandler<HTMLButtonElement>
      }) => (
        <button type="button" onClick={onClick} onMouseEnter={onMouseEnter}>{item.title}</button>
      ),
      Label: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Loader: () => <div>Loading</div>,
      Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    },
  }),
  useDictionary: () => ({ suggestion_menu: { no_items_title: 'No items' } }),
}))

import { TolariaSlashMenu } from './TolariaSlashMenu'
import type { TolariaSlashMenuItem } from './tolariaEditorFormattingConfig'

function calloutItem(): TolariaSlashMenuItem {
  return {
    aliases: [],
    key: 'callout',
    onItemClick: vi.fn(),
    submenuItems: [
      { key: 'callout_note', title: 'Note', onItemClick: vi.fn() },
      { key: 'callout_tip', title: 'Tip', onItemClick: vi.fn() },
    ],
    title: 'Callout',
  }
}

describe('TolariaSlashMenu', () => {
  it('opens the callout type submenu on the right and selects a clicked style', () => {
    const item = calloutItem()
    const onItemClick = vi.fn()
    render(<TolariaSlashMenu
      items={[item]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={onItemClick}
    />)

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Callout' }))

    const submenu = screen.getByRole('menu', { name: 'Callout' })
    expect(submenu).toHaveClass('tolaria-slash-menu__submenu')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tip' }))
    expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[1])
  })

  it('supports right-arrow entry and keyboard selection inside the submenu', () => {
    const item = calloutItem()
    const onItemClick = vi.fn()
    render(<TolariaSlashMenu
      items={[item]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={onItemClick}
    />)

    fireEvent.keyDown(editorElement, { key: 'ArrowRight' })
    fireEvent.keyDown(editorElement, { key: 'ArrowDown' })
    fireEvent.keyDown(editorElement, { key: 'Enter' })

    expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[1])
  })
})
