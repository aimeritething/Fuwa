import { describe, expect, it, vi } from 'vitest'
import {
  keepEditorFocusAfterMenuClose,
  keepFocusWhenLeavingClosingMenuItem,
  toolbarMenuAfter,
} from './toolbar-menu-state'

describe('toolbarMenuAfter', () => {
  it('opens the menu asked for and closes only the one that was open', () => {
    expect(toolbarMenuAfter(null, 'blockType', true)).toBe('blockType')
    expect(toolbarMenuAfter('blockType', 'blockType', false)).toBeNull()
    expect(toolbarMenuAfter('blockType', 'highlightColor', true)).toBe('highlightColor')
  })

  it('keeps the menu a click opened when the same click dismisses the other', () => {
    // The trigger's open lands first, the dismissed menu's close after.
    expect(toolbarMenuAfter('highlightColor', 'blockType', false)).toBe('highlightColor')
  })
})

describe('keepEditorFocusAfterMenuClose', () => {
  it('keeps the focus in the editor after a choice, and lets the trigger take it otherwise', () => {
    const editorElement = document.createElement('div')
    const text = document.createElement('button')
    editorElement.appendChild(text)
    document.body.appendChild(editorElement)
    const event = { preventDefault: vi.fn() }

    text.focus()
    keepEditorFocusAfterMenuClose(editorElement, event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)

    text.blur()
    keepEditorFocusAfterMenuClose(editorElement, event)
    keepEditorFocusAfterMenuClose(null, event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    editorElement.remove()
  })
})

describe('keepFocusWhenLeavingClosingMenuItem', () => {
  it('only stops the leave on a menu that is closing', () => {
    const event = { preventDefault: vi.fn() }
    keepFocusWhenLeavingClosingMenuItem(true, event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    keepFocusWhenLeavingClosingMenuItem(false, event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
