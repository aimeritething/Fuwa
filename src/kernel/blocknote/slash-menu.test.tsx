import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

const editorElement = document.createElement('div')
document.body.appendChild(editorElement)
const mocks = vi.hoisted(() => ({ suggestionMenuItemProps: vi.fn() }))

vi.mock('@blocknote/react', () => ({
  useBlockNoteEditor: () => ({ domElement: editorElement }),
  useComponentsContext: () => ({
    SuggestionMenu: {
      EmptyItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Item: (props: {
        item: { title: string }
        onClick: () => void
      }) => {
        mocks.suggestionMenuItemProps(props)
        const { item, onClick } = props
        return <button type="button" onClick={onClick}>{item.title}</button>
      },
      Label: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Loader: () => <div>Loading</div>,
      Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    },
  }),
  useDictionary: () => ({ suggestion_menu: { no_items_title: 'No items' } }),
}))

import { SlashMenu } from './slash-menu'
import type { SlashMenuItem } from './slash-menu-items'

function calloutItem(): SlashMenuItem {
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

describe('SlashMenu', () => {
  it('passes only supported props to the BlockNote suggestion item', () => {
    render(<SlashMenu
      items={[calloutItem()]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={vi.fn()}
    />)

    expect(mocks.suggestionMenuItemProps).toHaveBeenCalledWith(
      expect.not.objectContaining({ onMouseEnter: expect.anything() }),
    )
  })

  it('opens the callout type submenu on the right and selects a clicked style', () => {
    const item = calloutItem()
    const onItemClick = vi.fn()
    render(<SlashMenu
      items={[item]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={onItemClick}
    />)

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Callout' }))

    const submenu = screen.getByRole('menu', { name: 'Callout' })
    expect(submenu).toHaveClass('fixed', 'rounded-xl', 'shadow-menu')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tip' }))
    expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[1])
  })

  it('slides the submenu up when level with its row it would run off the viewport', () => {
    const rect = (overrides: Partial<DOMRect>) => ({
      bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}), ...overrides,
    }) as DOMRect
    const boundsSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'menu' ? rect({ height: 400 }) : rect({ right: 300, top: 700 })
    })
    const innerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    render(<SlashMenu items={[calloutItem()]} loadingState="loaded" selectedIndex={0} onItemClick={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Callout' }))

    expect(screen.getByRole('menu', { name: 'Callout' })).toHaveStyle({ left: '304px', top: '392px' })

    boundsSpy.mockRestore()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight })
  })

  it('supports right-arrow entry and keyboard selection inside the submenu', () => {
    const item = calloutItem()
    const onItemClick = vi.fn()
    render(<SlashMenu
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
  // BlockNote's own Enter closes the menu, clears the query and runs the row's
  // empty `onItemClick`: `/callout` + Enter used to leave an empty line.
  it('opens the submenu on Enter instead of running the parent row, and picks a style on the next Enter', () => {
    const item = calloutItem()
    const onItemClick = vi.fn()
    render(<SlashMenu
      items={[item]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={onItemClick}
    />)

    const enter = fireEvent.keyDown(editorElement, { key: 'Enter' })

    expect(enter).toBe(false)
    expect(onItemClick).not.toHaveBeenCalled()
    expect(screen.getByRole('menu', { name: 'Callout' })).toBeInTheDocument()

    fireEvent.keyDown(editorElement, { key: 'Enter' })
    expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[0])
  })

  it('leaves Enter alone on a row without a submenu', () => {
    const onItemClick = vi.fn()
    render(<SlashMenu
      items={[{ key: 'paragraph', title: 'Paragraph', onItemClick: vi.fn() }]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={onItemClick}
    />)

    expect(fireEvent.keyDown(editorElement, { key: 'Enter' })).toBe(true)
  })
  // BlockNote's own keyboard navigation listens on the editor element too, in
  // the same capture phase, and runs Enter as "execute the selected row". Which
  // of the two listeners ran first used to depend on which registered last.
  it('gets the submenu keys before a listener on the editor element, whichever registered first', () => {
    const rival = vi.fn()
    editorElement.addEventListener('keydown', rival, true)
    onTestFinished(() => editorElement.removeEventListener('keydown', rival, true))
    const item = calloutItem()
    const onItemClick = vi.fn()
    render(<SlashMenu
      items={[item]}
      loadingState="loaded"
      selectedIndex={0}
      onItemClick={onItemClick}
    />)

    fireEvent.keyDown(editorElement, { key: 'Enter' })
    fireEvent.keyDown(editorElement, { key: 'ArrowDown' })
    fireEvent.keyDown(editorElement, { key: 'Enter' })

    expect(rival).not.toHaveBeenCalled()
    expect(onItemClick).toHaveBeenCalledTimes(1)
    expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[1])
  })
})
