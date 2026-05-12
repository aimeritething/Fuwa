const CODE_BLOCK_SELECTOR = '.editor__blocknote-container .bn-block-content[data-content-type="codeBlock"]'

function elementFromNode(node: Node | null): Element | null {
  if (!node) return null
  return node instanceof Element ? node : node.parentElement
}

function rootContains(root: ParentNode, element: HTMLElement): boolean {
  return root === element.ownerDocument || root.contains(element)
}

function closestCodeBlock(node: Node | null, root: ParentNode): HTMLElement | null {
  const block = elementFromNode(node)?.closest<HTMLElement>(CODE_BLOCK_SELECTOR)
  return block && rootContains(root, block) ? block : null
}

function isSelectAllShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey) && !event.altKey
}

function codeBlockFromSelection(selection: Selection | null, root: ParentNode): HTMLElement | null {
  if (!selection || selection.rangeCount === 0) return null

  const anchorBlock = closestCodeBlock(selection.anchorNode, root)
  if (!anchorBlock) return null

  const focusBlock = closestCodeBlock(selection.focusNode, root)
  return focusBlock === anchorBlock ? anchorBlock : null
}

function codeBlockFromActiveElement(doc: Document): HTMLElement | null {
  const activeElement = doc.activeElement
  return activeElement ? closestCodeBlock(activeElement, doc) : null
}

function codeElementForBlock(codeBlock: HTMLElement): HTMLElement | null {
  return codeBlock.querySelector<HTMLElement>('pre code')
}

function selectCodeElement(codeElement: HTMLElement): void {
  const doc = codeElement.ownerDocument
  const selection = doc.getSelection()
  if (!selection) return

  const range = doc.createRange()
  range.selectNodeContents(codeElement)
  selection.removeAllRanges()
  selection.addRange(range)
}

export function lineNumbersForText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
  const lineCount = Math.max(1, trimmed.split('\n').length)

  return Array.from({ length: lineCount }, (_, index) => String(index + 1)).join('\n')
}

export function handleCodeBlockSelectAll(event: KeyboardEvent, doc: Document = document): boolean {
  if (!isSelectAllShortcut(event)) return false

  const selection = doc.getSelection()
  const codeBlock = codeBlockFromSelection(selection, doc) ?? codeBlockFromActiveElement(doc)
  const codeElement = codeBlock ? codeElementForBlock(codeBlock) : null
  if (!codeElement) return false

  event.preventDefault()
  event.stopPropagation()
  selectCodeElement(codeElement)
  return true
}

export function installCodeBlockEnhancements(doc: Document = document): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    handleCodeBlockSelectAll(event, doc)
  }

  doc.addEventListener('keydown', handleKeyDown, true)

  return () => {
    doc.removeEventListener('keydown', handleKeyDown, true)
  }
}
