import { describe, expect, it } from 'vitest'
import {
  isWithinFormattingToolbarHoverBridge,
  shouldSuppressFormattingToolbarHoverUpdate,
} from './blockNoteFormattingToolbarHoverGuard'

function rect(left: number, top: number, width: number, height: number) {
  return DOMRect.fromRect({ x: left, y: top, width, height })
}

function setRect(element: HTMLElement, nextRect: DOMRect) {
  element.getBoundingClientRect = () => nextRect
}

describe('blockNoteFormattingToolbarHoverGuard', () => {
  it('treats the gap between the selected image block and toolbar as part of the hover bridge', () => {
    expect(
      isWithinFormattingToolbarHoverBridge(
        { x: 368, y: 104 },
        rect(300, 130, 140, 90),
        rect(322, 78, 96, 24),
      ),
    ).toBe(true)
  })

  it('suppresses hover updates when the pointer is already over the toolbar', () => {
    const container = document.createElement('div')
    const block = document.createElement('div')
    block.className = 'bn-block'
    block.dataset.id = 'image-block'
    const fileBlock = document.createElement('div')
    fileBlock.dataset.fileBlock = 'true'
    block.appendChild(fileBlock)
    container.appendChild(block)
    document.body.appendChild(container)

    const toolbar = document.createElement('div')
    toolbar.className = 'bn-formatting-toolbar'
    const toolbarButton = document.createElement('button')
    toolbar.appendChild(toolbarButton)
    document.body.appendChild(toolbar)

    setRect(fileBlock, rect(300, 130, 140, 90))
    setRect(toolbar, rect(322, 78, 96, 24))

    expect(
      shouldSuppressFormattingToolbarHoverUpdate({
        eventTarget: toolbarButton,
        point: { x: 350, y: 90 },
        container,
        doc: document,
        selectedFileBlockId: 'image-block',
      }),
    ).toBe(true)
  })

  it('suppresses hover updates while the pointer crosses the image-toolbar bridge', () => {
    const container = document.createElement('div')
    const block = document.createElement('div')
    block.className = 'bn-block'
    block.dataset.id = 'image-block'
    const fileBlock = document.createElement('div')
    fileBlock.dataset.fileBlock = 'true'
    block.appendChild(fileBlock)
    container.appendChild(block)
    document.body.appendChild(container)

    const toolbar = document.createElement('div')
    toolbar.className = 'bn-formatting-toolbar'
    document.body.appendChild(toolbar)

    setRect(fileBlock, rect(300, 130, 140, 90))
    setRect(toolbar, rect(322, 78, 96, 24))

    expect(
      shouldSuppressFormattingToolbarHoverUpdate({
        eventTarget: document.body,
        point: { x: 368, y: 104 },
        container,
        doc: document,
        selectedFileBlockId: 'image-block',
      }),
    ).toBe(true)
  })

  it('leaves unrelated pointer movement alone', () => {
    const container = document.createElement('div')
    const block = document.createElement('div')
    block.className = 'bn-block'
    block.dataset.id = 'image-block'
    const fileBlock = document.createElement('div')
    fileBlock.dataset.fileBlock = 'true'
    block.appendChild(fileBlock)
    container.appendChild(block)
    document.body.appendChild(container)

    const toolbar = document.createElement('div')
    toolbar.className = 'bn-formatting-toolbar'
    document.body.appendChild(toolbar)

    setRect(fileBlock, rect(300, 130, 140, 90))
    setRect(toolbar, rect(322, 78, 96, 24))

    expect(
      shouldSuppressFormattingToolbarHoverUpdate({
        eventTarget: document.body,
        point: { x: 520, y: 220 },
        container,
        doc: document,
        selectedFileBlockId: 'image-block',
      }),
    ).toBe(false)
  })
})
