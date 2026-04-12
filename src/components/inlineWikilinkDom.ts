import {
  chipToken,
  normalizeInlineWikilinkValue,
} from './inlineWikilinkTokens'

export function serializeInlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeInlineWikilinkValue(node.textContent ?? '')
  }

  if (node instanceof HTMLElement) {
    if (node.dataset.chipTarget) {
      return chipToken(node.dataset.chipTarget)
    }

    if (node.tagName === 'BR') return ''
  }

  return Array.from(node.childNodes).map(serializeInlineNode).join('')
}

function selectionFallsOutsideEditor(
  selection: Selection | null,
  root: HTMLDivElement,
): boolean {
  return (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.anchorNode ||
    !root.contains(selection.anchorNode)
  )
}

export function readSelectionIndex(root: HTMLDivElement): number {
  const currentSelection = window.getSelection()
  if (
    !currentSelection ||
    selectionFallsOutsideEditor(currentSelection, root)
  ) {
    return serializeInlineNode(root).length
  }

  const range = currentSelection.getRangeAt(0).cloneRange()
  range.setStart(root, 0)
  return serializeInlineNode(range.cloneContents()).length
}

export function applySelectionIndex(
  root: HTMLDivElement,
  selectionIndex: number,
) {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  const clampedIndex = Math.max(0, selectionIndex)
  const found = placeRangeAtIndex(root, clampedIndex, range)

  if (!found) {
    range.selectNodeContents(root)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

function placeRangeAtIndex(
  node: Node,
  selectionIndex: number,
  range: Range,
): boolean {
  let remaining = selectionIndex

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const textPlacement = placeRangeInTextNode(child, remaining, range)
      if (textPlacement.placed) return true
      remaining = textPlacement.remaining
      continue
    }

    if (!(child instanceof HTMLElement)) continue

    if (child.dataset.chipTarget) {
      const chipPlacement = placeRangeAroundChip(child, remaining, range)
      if (chipPlacement.placed) return true
      remaining = chipPlacement.remaining
      continue
    }

    if (placeRangeAtIndex(child, remaining, range)) return true
    remaining -= serializeInlineNode(child).length
  }

  return false
}

function placeRangeInTextNode(
  node: Node,
  remaining: number,
  range: Range,
) {
  const textLength = normalizeInlineWikilinkValue(node.textContent ?? '').length
  if (remaining <= textLength) {
    range.setStart(node, remaining)
    range.collapse(true)
    return { placed: true, remaining: 0 }
  }

  return { placed: false, remaining: remaining - textLength }
}

function placeRangeAroundChip(
  node: HTMLElement,
  remaining: number,
  range: Range,
) {
  const tokenLength = chipToken(node.dataset.chipTarget ?? '').length

  if (remaining <= 0) {
    range.setStartBefore(node)
    range.collapse(true)
    return { placed: true, remaining: 0 }
  }

  if (remaining <= tokenLength) {
    range.setStartAfter(node)
    range.collapse(true)
    return { placed: true, remaining: 0 }
  }

  return { placed: false, remaining: remaining - tokenLength }
}
