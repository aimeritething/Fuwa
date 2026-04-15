import { describe, expect, it } from 'vitest'
import {
  isWithinBlockNoteHandleHoverBridge,
  shouldSuppressBlockNoteHandleHoverUpdate,
} from './blockNoteSideMenuHoverGuard'

function rect(left: number, top: number, width: number, height: number) {
  return DOMRect.fromRect({ x: left, y: top, width, height })
}

function setRect(element: HTMLElement, nextRect: DOMRect) {
  element.getBoundingClientRect = () => nextRect
}

describe('blockNoteSideMenuHoverGuard', () => {
  it('treats the side-menu gutter as part of the hover bridge', () => {
    expect(
      isWithinBlockNoteHandleHoverBridge(
        { x: 228, y: 118 },
        rect(240, 90, 420, 32),
        rect(190, 96, 32, 24),
      ),
    ).toBe(true)
  })

  it('ignores points outside the side-menu bridge band', () => {
    expect(
      isWithinBlockNoteHandleHoverBridge(
        { x: 228, y: 150 },
        rect(240, 90, 420, 32),
        rect(190, 96, 32, 24),
      ),
    ).toBe(false)
  })

  it('suppresses hover updates when the pointer is already over the side menu', () => {
    const container = document.createElement('div')
    const editor = document.createElement('div')
    editor.className = 'bn-editor'
    container.appendChild(editor)
    document.body.appendChild(container)

    const sideMenu = document.createElement('div')
    sideMenu.className = 'bn-side-menu'
    const sideMenuButton = document.createElement('button')
    sideMenu.appendChild(sideMenuButton)
    document.body.appendChild(sideMenu)

    setRect(editor, rect(240, 90, 420, 32))
    setRect(sideMenu, rect(190, 96, 32, 24))

    expect(
      shouldSuppressBlockNoteHandleHoverUpdate({
        eventTarget: sideMenuButton,
        point: { x: 200, y: 110 },
        container,
        doc: document,
      }),
    ).toBe(true)
  })

  it('suppresses hover updates while the pointer crosses the handle bridge', () => {
    const container = document.createElement('div')
    const editor = document.createElement('div')
    editor.className = 'bn-editor'
    container.appendChild(editor)
    document.body.appendChild(container)

    const sideMenu = document.createElement('div')
    sideMenu.className = 'bn-side-menu'
    document.body.appendChild(sideMenu)

    setRect(editor, rect(240, 90, 420, 32))
    setRect(sideMenu, rect(190, 96, 32, 24))

    expect(
      shouldSuppressBlockNoteHandleHoverUpdate({
        eventTarget: document.body,
        point: { x: 226, y: 116 },
        container,
        doc: document,
      }),
    ).toBe(true)
  })

  it('leaves unrelated pointer movement alone', () => {
    const container = document.createElement('div')
    const editor = document.createElement('div')
    editor.className = 'bn-editor'
    container.appendChild(editor)
    document.body.appendChild(container)

    const sideMenu = document.createElement('div')
    sideMenu.className = 'bn-side-menu'
    document.body.appendChild(sideMenu)

    setRect(editor, rect(240, 90, 420, 32))
    setRect(sideMenu, rect(190, 96, 32, 24))

    expect(
      shouldSuppressBlockNoteHandleHoverUpdate({
        eventTarget: document.body,
        point: { x: 360, y: 160 },
        container,
        doc: document,
      }),
    ).toBe(false)
  })
})
