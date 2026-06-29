import { BlockNoteEditor } from '@blocknote/core'
import { afterEach, describe, expect, it } from 'vitest'
import { schema } from './editorSchema'
import {
  blockSelectionAfterArrow,
  createRichEditorBlockSelectionExtension,
  richEditorBlockSelectionPluginKey,
} from './richEditorBlockSelectionExtension'

type MountedEditor = {
  cleanup: () => void
  editor: ReturnType<typeof BlockNoteEditor.create>
  mount: HTMLElement
}

function createMountedEditor(): MountedEditor {
  const mount = document.createElement('div')
  document.body.appendChild(mount)

  const editor = BlockNoteEditor.create({
    extensions: [createRichEditorBlockSelectionExtension()],
    initialContent: [
      { id: 'one', type: 'paragraph', content: 'One' },
      { id: 'two', type: 'paragraph', content: 'Two' },
      { id: 'three', type: 'paragraph', content: 'Three' },
    ],
    schema,
  })
  editor.mount(mount)

  return {
    editor,
    mount,
    cleanup: () => {
      editor.unmount()
      mount.remove()
    },
  }
}

function dispatchEditorKey(editor: MountedEditor['editor'], key: string, options: KeyboardEventInit = {}) {
  const view = editor._tiptapEditor.view
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  })
  const handled = view.someProp('handleKeyDown', (handler) => handler(view, event))

  return { event, handled: handled === true }
}

function selectedBlockIds(editor: MountedEditor['editor']): string[] {
  return richEditorBlockSelectionPluginKey.getState(editor._tiptapEditor.state)?.blockIds ?? []
}

describe('rich editor block selection extension', () => {
  const mountedEditors: MountedEditor[] = []

  afterEach(() => {
    while (mountedEditors.length > 0) {
      mountedEditors.pop()?.cleanup()
    }
  })

  function mountEditor() {
    const mounted = createMountedEditor()
    mountedEditors.push(mounted)
    return mounted.editor
  }

  it('promotes the current cursor block to editor-owned block selection on Escape', () => {
    const editor = mountEditor()
    editor.setTextCursorPosition('two', 'end')

    const result = dispatchEditorKey(editor, 'Escape')

    expect(result.handled).toBe(true)
    expect(result.event.defaultPrevented).toBe(true)
    expect(selectedBlockIds(editor)).toEqual(['two'])
    expect(editor._tiptapEditor.state.selection.empty).toBe(true)
  })

  it('promotes a native multi-block text selection to a block selection range', () => {
    const editor = mountEditor()
    editor.setSelection('one', 'three')

    const result = dispatchEditorKey(editor, 'Escape')

    expect(result.handled).toBe(true)
    expect(selectedBlockIds(editor)).toEqual(['one', 'two', 'three'])
    expect(editor._tiptapEditor.state.selection.empty).toBe(true)
  })

  it('keeps arrows inside the editor while block selection is active', () => {
    const editor = mountEditor()
    editor.setTextCursorPosition('two', 'end')
    dispatchEditorKey(editor, 'Escape')

    const result = dispatchEditorKey(editor, 'ArrowDown')

    expect(result.handled).toBe(true)
    expect(result.event.defaultPrevented).toBe(true)
    expect(selectedBlockIds(editor)).toEqual(['three'])
  })

  it('renders a decoration class for selected blocks', () => {
    const mounted = createMountedEditor()
    mountedEditors.push(mounted)
    mounted.editor.setTextCursorPosition('two', 'end')

    dispatchEditorKey(mounted.editor, 'Escape')

    const selectedBlocks = mounted.mount.querySelectorAll('.tolaria-rich-editor-block-selected')
    expect(selectedBlocks).toHaveLength(1)
    expect(selectedBlocks[0].getAttribute('data-tolaria-block-selection')).toBe('single')
  })

  it('lets a second Escape fall through to app-level note-list navigation', () => {
    const editor = mountEditor()
    editor.setTextCursorPosition('two', 'end')
    dispatchEditorKey(editor, 'Escape')

    const result = dispatchEditorKey(editor, 'Escape')

    expect(result.event.defaultPrevented).toBe(false)
    expect(selectedBlockIds(editor)).toEqual([])
  })

  it('deletes the selected block and keeps the next block selected', () => {
    const editor = mountEditor()
    editor.setTextCursorPosition('two', 'end')
    dispatchEditorKey(editor, 'Escape')

    const result = dispatchEditorKey(editor, 'Delete')

    expect(result.handled).toBe(true)
    expect(result.event.defaultPrevented).toBe(true)
    expect(editor.document.map((block) => block.id)).not.toContain('two')
    expect(editor.document.map((block) => block.id).slice(0, 2)).toEqual(['one', 'three'])
    expect(selectedBlockIds(editor)).toEqual(['three'])
  })
})

describe('blockSelectionAfterArrow', () => {
  it('moves a single selected block up and down by document order', () => {
    const blockIds = ['one', 'two', 'three']

    expect(blockSelectionAfterArrow(['two'], blockIds, 'up', false)).toEqual(['one'])
    expect(blockSelectionAfterArrow(['two'], blockIds, 'down', false)).toEqual(['three'])
  })

  it('extends a selected block range when Shift is held', () => {
    const blockIds = ['one', 'two', 'three']

    expect(blockSelectionAfterArrow(['two'], blockIds, 'up', true)).toEqual(['one', 'two'])
    expect(blockSelectionAfterArrow(['one', 'two'], blockIds, 'down', true)).toEqual(['one', 'two', 'three'])
  })
})
