import { history, undo } from '@tiptap/pm/history'
import { Schema, type Node as ProsemirrorNode, type Slice } from '@tiptap/pm/model'
import { EditorState, NodeSelection, type Transaction } from '@tiptap/pm/state'
import { describe, expect, it, vi } from 'vitest'
import { createMalformedBlockClipboardRecoveryPlugin } from './richEditorMalformedClipboardRecovery'

const schema = new Schema({
  nodes: {
    doc: { content: 'blockGroup' },
    blockGroup: { content: 'blockContainer+' },
    blockContainer: { content: 'blockContent blockGroup?', group: 'bnBlock' },
    paragraph: {
      content: 'text*',
      group: 'blockContent',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
})

class ClipboardDataStub {
  readonly values = new Map<string, string>()

  clearData() {
    this.values.clear()
  }

  setData(type: string, value: string) {
    this.values.set(type, value)
  }
}

function paragraph(text: string) {
  return schema.node('paragraph', null, text ? schema.text(text) : undefined)
}

function block(id: string, text: string) {
  return schema.node('blockContainer', { id }, paragraph(text))
}

function malformedBlock(id: string) {
  return schema.nodes.blockContainer.create({ id })
}

function editorDocument(first: ProsemirrorNode) {
  return schema.node('doc', null, schema.node('blockGroup', null, [first, block('keep', 'Keep')]))
}

function clipboardEvent(data: ClipboardDataStub) {
  return {
    clipboardData: data,
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent
}

function createView(doc: ProsemirrorNode) {
  let state = EditorState.create({
    doc,
    plugins: [history(), createMalformedBlockClipboardRecoveryPlugin()],
    selection: NodeSelection.create(doc, 1),
  })
  const dispatch = vi.fn((transaction: Transaction) => {
    state = state.apply(transaction)
  })
  const dom = document.createElement('div')
  dom.innerHTML = '<div data-node-type="blockContainer"></div>'
  const view = {
    dispatch,
    get editable() { return true },
    get state() { return state },
    serializeForClipboard: vi.fn((slice: Slice) => ({
      dom,
      slice,
      text: slice.content.textBetween(0, slice.content.size, '\n'),
    })),
  }
  return { dispatch, getState: () => state, view }
}

function clipboardHandler(kind: 'copy' | 'cut') {
  const plugin = createMalformedBlockClipboardRecoveryPlugin()
  const handlers = plugin.props.handleDOMEvents
  const handler = kind === 'copy' ? handlers?.copy : handlers?.cut
  if (!handler) throw new Error(`Missing ${kind} recovery handler`)
  return handler
}

describe('malformed block clipboard recovery', () => {
  it('copies and removes a selected content-less block without throwing', () => {
    const { dispatch, getState, view } = createView(editorDocument(malformedBlock('broken')))
    const data = new ClipboardDataStub()
    const event = clipboardEvent(data)

    expect(clipboardHandler('cut')(view as never, event)).toBe(true)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(data.values.get('blocknote/html')).toContain('blockContainer')
    expect(data.values.get('text/html')).toContain('blockContainer')
    expect(data.values.get('text/plain')).toBe('')
    expect(dispatch).toHaveBeenCalledOnce()
    expect(getState().doc.textContent).toBe('Keep')

    expect(undo(getState(), view.dispatch)).toBe(true)
    expect(getState().doc.child(0).childCount).toBe(2)
  })

  it('copies a malformed selection without deleting it', () => {
    const { dispatch, getState, view } = createView(editorDocument(malformedBlock('broken')))
    const event = clipboardEvent(new ClipboardDataStub())

    expect(clipboardHandler('copy')(view as never, event)).toBe(true)

    expect(dispatch).not.toHaveBeenCalled()
    expect(getState().doc.child(0).childCount).toBe(2)
  })

  it('leaves valid block copy and cut behavior to BlockNote', () => {
    const { view } = createView(editorDocument(block('selected', 'Selected')))
    const copy = clipboardEvent(new ClipboardDataStub())
    const cut = clipboardEvent(new ClipboardDataStub())

    expect(clipboardHandler('copy')(view as never, copy)).toBe(false)
    expect(clipboardHandler('cut')(view as never, cut)).toBe(false)
    expect(copy.preventDefault).not.toHaveBeenCalled()
    expect(cut.preventDefault).not.toHaveBeenCalled()
  })

  it('detects malformed nested blocks while leaving paste, delete, and drag handlers unchanged', () => {
    const childGroup = schema.node('blockGroup', null, malformedBlock('nested-broken'))
    const parent = schema.nodes.blockContainer.create({ id: 'parent' }, [paragraph('Parent'), childGroup])
    const { view } = createView(editorDocument(parent))
    const plugin = createMalformedBlockClipboardRecoveryPlugin()

    expect(clipboardHandler('copy')(view as never, clipboardEvent(new ClipboardDataStub()))).toBe(true)
    expect(plugin.props.handleDOMEvents?.paste).toBeUndefined()
    expect(plugin.props.handleDOMEvents?.dragstart).toBeUndefined()
    expect(plugin.props.handleKeyDown).toBeUndefined()
  })
})
