import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAppCommandDispatchStateForTests } from './appCommandDispatcher'
import { handleAppKeyboardEvent, type KeyboardActions } from './appKeyboardShortcuts'

function actions(overrides: Partial<KeyboardActions> = {}): KeyboardActions {
  return {
    onCreateNote: vi.fn(),
    onQuickOpen: vi.fn(),
    onSave: vi.fn(),
    onPastePlainText: vi.fn(),
    onCommandPalette: vi.fn(),
    onFindInNote: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    ...overrides,
  }
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true, ...init })
}

describe('handleAppKeyboardEvent', () => {
  beforeEach(() => {
    resetAppCommandDispatchStateForTests()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('⌘K opens the Command Menu', () => {
    const handlers = actions()
    const event = press('k')
    handleAppKeyboardEvent(handlers, event)
    expect(handlers.onCommandPalette).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('⌘K with text selected in Rich mode goes to the editor\'s link command, not the Command Menu', () => {
    document.body.innerHTML = `
      <div class="bn-editor" contenteditable="true" tabindex="0"><p>Some text</p></div>
      <button data-test="createLink">Link</button>
    `
    const editor = document.querySelector<HTMLElement>('.bn-editor')!
    const link = document.querySelector<HTMLButtonElement>('[data-test="createLink"]')!
    const onLink = vi.fn()
    link.addEventListener('click', onLink)
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor.firstElementChild!)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)

    const handlers = actions()
    handleAppKeyboardEvent(handlers, press('k'))
    expect(onLink).toHaveBeenCalledTimes(1)
    expect(handlers.onCommandPalette).not.toHaveBeenCalled()
  })

  it('⌘K with a collapsed selection in Rich mode still opens the Command Menu', () => {
    document.body.innerHTML = '<div class="bn-editor" contenteditable="true" tabindex="0"><p>Some text</p></div>'
    const editor = document.querySelector<HTMLElement>('.bn-editor')!
    editor.focus()
    window.getSelection()!.collapse(editor.firstElementChild!.firstChild, 2)

    const handlers = actions()
    handleAppKeyboardEvent(handlers, press('k'))
    expect(handlers.onCommandPalette).toHaveBeenCalledTimes(1)
  })

  it('⌘P is Quick Open', () => {
    const handlers = actions()
    handleAppKeyboardEvent(handlers, press('p'))
    expect(handlers.onQuickOpen).toHaveBeenCalledTimes(1)
  })

  it('⌘F opens find with the editor focused, or with nothing focused', () => {
    document.body.innerHTML = '<div data-editor-find-scope="true"><div class="bn-editor" contenteditable="true" tabindex="0">Text</div></div>'
    const handlers = actions()
    handleAppKeyboardEvent(handlers, press('f'))
    expect(handlers.onFindInNote).toHaveBeenCalledTimes(1)

    document.querySelector<HTMLElement>('.bn-editor')!.focus()
    handleAppKeyboardEvent(handlers, press('f'))
    expect(handlers.onFindInNote).toHaveBeenCalledTimes(2)
  })

  it('⌘F leaves a text field outside the editor alone, such as the palette\'s input', () => {
    document.body.innerHTML = '<div data-command-palette="true"><input type="text" /></div>'
    document.querySelector('input')!.focus()
    const handlers = actions()
    const event = press('f')
    handleAppKeyboardEvent(handlers, event)
    expect(handlers.onFindInNote).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
