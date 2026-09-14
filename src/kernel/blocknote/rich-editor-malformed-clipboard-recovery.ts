import type { Fragment, Node as ProsemirrorNode } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

interface ClipboardTransfer {
  clearData: () => void
  setData: (type: string, value: string) => void
}

type ClipboardEventKind = 'copy' | 'cut'

function isBlockContent(node: ProsemirrorNode): boolean {
  return node.type.spec.group === 'blockContent'
}

function blockContainerCanBeSerialized(node: ProsemirrorNode): boolean {
  if (node.firstChild?.type.name === 'blockGroup') return true

  let hasBlockContent = false
  node.forEach((child) => {
    hasBlockContent ||= isBlockContent(child)
  })
  return hasBlockContent
}

function fragmentContainsMalformedBlock(fragment: Fragment): boolean {
  let malformed = false
  fragment.forEach((node) => {
    if (malformed) return
    if (node.type.name === 'blockContainer' && !blockContainerCanBeSerialized(node)) {
      malformed = true
      return
    }
    malformed = fragmentContainsMalformedBlock(node.content)
  })
  return malformed
}

function writeSelectionToClipboard(view: EditorView, transfer: ClipboardTransfer): void {
  const serialized = view.serializeForClipboard(view.state.selection.content())
  const serializer = new XMLSerializer()
  const markup = Array.from(serialized.dom.childNodes, (node) => serializer.serializeToString(node)).join('')

  transfer.clearData()
  transfer.setData('blocknote/html', markup)
  transfer.setData('text/html', markup)
  transfer.setData('text/plain', serialized.text)
}

function recoverMalformedClipboardEvent(
  view: EditorView,
  event: ClipboardEvent,
  kind: ClipboardEventKind,
): boolean {
  const transfer = event.clipboardData
  const selected = view.state.selection.content()
  if (!transfer || !fragmentContainsMalformedBlock(selected.content)) return false

  writeSelectionToClipboard(view, transfer)
  event.preventDefault()
  if (kind === 'cut' && view.editable) view.dispatch(view.state.tr.deleteSelection())
  return true
}

export function createMalformedBlockClipboardRecoveryPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        copy: (view, event) => recoverMalformedClipboardEvent(view, event, 'copy'),
        cut: (view, event) => recoverMalformedClipboardEvent(view, event, 'cut'),
      },
    },
  })
}
