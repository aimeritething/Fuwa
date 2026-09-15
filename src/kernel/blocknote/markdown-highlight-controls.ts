import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { HighlightBoundaryColorControl } from './markdown-highlight-boundary-control'
import { ToolbarHighlightColorControl } from './markdown-highlight-toolbar-control'
import type { HighlightEditor } from './markdown-highlight-model'

export {
  applyMarkdownHighlightColor,
  toggleDefaultMarkdownHighlight,
} from './markdown-highlight-model'
export { readMarkdownHighlightRange } from './markdown-highlight-range'

function unmountControl(root: Root, host: HTMLElement) {
  queueMicrotask(() => {
    root.unmount()
    host.remove()
  })
}

function mountToolbarControl(
  editor: HighlightEditor,
  container: Element,
  ownerDocument: Document,
): { host: HTMLElement; root: Root } {
  const host = ownerDocument.createElement('div')
  host.className = 'relative z-popover'
  ownerDocument.body.appendChild(host)

  const root = createRoot(host)
  root.render(createElement(ToolbarHighlightColorControl, { container, editor }))
  return { host, root }
}

function mountBoundaryControl(editor: HighlightEditor, ownerDocument: Document): {
  host: HTMLElement
  root: Root
} {
  const host = ownerDocument.createElement('div')
  host.className = 'relative z-sticky'
  ownerDocument.body.appendChild(host)
  const root = createRoot(host)
  root.render(createElement(HighlightBoundaryColorControl, { editor }))
  return { host, root }
}

export function mountMarkdownHighlightControls({
  dom,
  editor,
  signal,
}: {
  dom: HTMLElement
  editor: HighlightEditor
  signal: AbortSignal
}) {
  const container = dom.closest('.editor__blocknote-container') ?? dom.parentElement
  if (!container) return

  const toolbarControl = mountToolbarControl(editor, container, dom.ownerDocument)
  const boundaryControl = mountBoundaryControl(editor, dom.ownerDocument)
  signal.addEventListener('abort', () => {
    unmountControl(toolbarControl.root, toolbarControl.host)
    unmountControl(boundaryControl.root, boundaryControl.host)
  }, { once: true })
}
