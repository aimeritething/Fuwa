import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleAppKeyboardEvent, type KeyboardActions } from './appKeyboardShortcuts'

function commandPaletteActions(): KeyboardActions {
  return {
    onCommandPalette: vi.fn(),
  } as unknown as KeyboardActions
}

function commandKEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'k',
    metaKey: true,
  })
}

function selectEditorText(editor: HTMLElement): void {
  const text = document.createTextNode('selected label')
  editor.appendChild(text)
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, text.length)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('app keyboard link shortcut ownership', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    document.body.replaceChildren()
  })

  it('lets the rich editor handle Cmd+K while text is selected', () => {
    const editor = document.createElement('div')
    editor.className = 'bn-editor'
    editor.setAttribute('contenteditable', 'true')
    editor.tabIndex = 0
    document.body.appendChild(editor)
    editor.focus()
    selectEditorText(editor)
    const createLink = document.createElement('button')
    createLink.dataset.test = 'createLink'
    const click = vi.spyOn(createLink, 'click')
    document.body.appendChild(createLink)
    const actions = commandPaletteActions()
    const event = commandKEvent()

    expect(document.activeElement).toBe(editor)
    expect(window.getSelection()?.isCollapsed).toBe(false)
    handleAppKeyboardEvent(actions, event)

    expect(actions.onCommandPalette).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('keeps Cmd+K assigned to the command palette without a rich-editor selection', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const actions = commandPaletteActions()
    const event = commandKEvent()

    handleAppKeyboardEvent(actions, event)

    expect(actions.onCommandPalette).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })
})
