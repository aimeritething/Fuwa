const CODE_BLOCK_SELECTOR = '[data-content-type="codeBlock"]'
const LINE_NUMBER_LAYER_CLASS = 'editor__code-line-number-layer'

function codeBlockParts(block: Element) {
  const pre = block.querySelector<HTMLElement>('pre')
  const code = pre?.querySelector<HTMLElement>('code') ?? null
  return { code, pre }
}

function createLineNumbers(lineCount: number): HTMLElement {
  const gutter = document.createElement('span')
  gutter.setAttribute('data-code-line-numbers', '')
  gutter.setAttribute('contenteditable', 'false')
  gutter.setAttribute('aria-hidden', 'true')

  for (let line = 1; line <= lineCount; line += 1) {
    const number = document.createElement('span')
    number.textContent = String(line)
    gutter.appendChild(number)
  }
  return gutter
}

function textBoundaryAt(code: HTMLElement, targetOffset: number): [Node, number] {
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
  let remaining = targetOffset
  let current = walker.nextNode()

  while (current) {
    const length = current.textContent?.length ?? 0
    if (remaining <= length) return [current, remaining]
    remaining -= length
    current = walker.nextNode()
  }
  return [code, code.childNodes.length]
}

function rangeTopAtOffset(code: HTMLElement, offset: number): number | null {
  const range = document.createRange()
  const [startNode, startOffset] = textBoundaryAt(code, offset)
  range.setStart(startNode, startOffset)
  range.collapse(true)
  const caretRect = Array.from(range.getClientRects?.() ?? [])[0]
  if (caretRect) return caretRect.top

  const nextOffset = Math.min(offset + 1, code.textContent?.length ?? 0)
  if (nextOffset === offset) return null
  const [endNode, endOffset] = textBoundaryAt(code, nextOffset)
  range.setEnd(endNode, endOffset)
  return Array.from(range.getClientRects()).at(0)?.top ?? null
}

function numericStyle(style: CSSStyleDeclaration, property: 'paddingBottom' | 'paddingLeft' | 'paddingTop'): number {
  const rawValue = property === 'paddingBottom'
    ? style.paddingBottom
    : property === 'paddingLeft'
      ? style.paddingLeft
      : style.paddingTop
  const value = Number.parseFloat(rawValue)
  return Number.isFinite(value) ? value : 0
}

function updateLinePositions(code: HTMLElement, pre: HTMLElement, gutter: HTMLElement, lines: string[]): void {
  const computedStyle = getComputedStyle(code)
  const computedLineHeight = Number.parseFloat(computedStyle.lineHeight)
  const lineHeight = Number.isFinite(computedLineHeight) ? computedLineHeight : 20
  const preStyle = getComputedStyle(pre)
  const preRect = pre.getBoundingClientRect()
  const contentTop = preRect.top + numericStyle(preStyle, 'paddingTop')
  const contentHeight = Math.max(
    preRect.height - numericStyle(preStyle, 'paddingTop') - numericStyle(preStyle, 'paddingBottom'),
    lineHeight,
  )
  gutter.style.fontFamily = computedStyle.fontFamily
  gutter.style.fontSize = computedStyle.fontSize
  gutter.style.height = `${contentHeight}px`
  gutter.style.lineHeight = `${lineHeight}px`
  let offset = 0
  let fallbackTop = contentTop

  lines.forEach((line, index) => {
    const number = gutter.children.item(index) as HTMLElement | null
    const measuredTop = rangeTopAtOffset(code, offset) ?? fallbackTop
    if (number) number.style.top = `${Math.max(measuredTop - contentTop, 0)}px`
    fallbackTop = measuredTop + lineHeight
    offset += line.length + 1
  })
}

function positionGutter(pre: HTMLElement, host: HTMLElement, gutter: HTMLElement): void {
  const preStyle = getComputedStyle(pre)
  const preRect = pre.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  gutter.style.left = `${preRect.left - hostRect.left + host.scrollLeft + numericStyle(preStyle, 'paddingLeft')}px`
  gutter.style.top = `${preRect.top - hostRect.top + host.scrollTop + numericStyle(preStyle, 'paddingTop')}px`
}

export function syncCodeBlockLineNumbers(
  root: ParentNode,
  layer: HTMLElement,
  host: HTMLElement = layer.parentElement ?? layer,
): void {
  const gutters: HTMLElement[] = []
  root.querySelectorAll(CODE_BLOCK_SELECTOR).forEach((block) => {
    const { code, pre } = codeBlockParts(block)
    if (!code || !pre) return

    const lines = (code.textContent ?? '').split('\n')
    const gutter = createLineNumbers(lines.length)
    positionGutter(pre, host, gutter)
    updateLinePositions(code, pre, gutter, lines)
    gutters.push(gutter)
  })
  layer.replaceChildren(...gutters)
}

export function installCodeBlockLineNumbers(root: HTMLElement, signal: AbortSignal): void {
  const host = root.parentElement ?? root
  const layer = document.createElement('div')
  layer.className = LINE_NUMBER_LAYER_CLASS
  host.classList.add('editor__code-line-number-host')
  host.appendChild(layer)

  const sync = () => syncCodeBlockLineNumbers(root, layer, host)
  const mutationObserver = new MutationObserver(sync)
  mutationObserver.observe(root, { childList: true, characterData: true, subtree: true })
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
  resizeObserver?.observe(root)
  root.ownerDocument.addEventListener('scroll', sync, { capture: true, signal })

  signal.addEventListener('abort', () => {
    mutationObserver.disconnect()
    resizeObserver?.disconnect()
    layer.remove()
    host.classList.remove('editor__code-line-number-host')
  }, { once: true })
  sync()
}
