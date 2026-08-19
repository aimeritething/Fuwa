const IRONCALC_EDITOR_TEXT_COLOR = '#111827'
const NORMALIZED_IRONCALC_EDITOR_TEXT_COLOR = 'rgb(17, 24, 39)'

function isIronCalcTextInput(input: HTMLTextAreaElement): boolean {
  return input.style.backgroundColor === 'transparent'
    && input.style.color === 'transparent'
    && input.spellcheck === false
}

function visibleTextEditor(input: HTMLTextAreaElement): HTMLElement | null {
  const editor = input.parentElement
  if (!editor || !isIronCalcTextInput(input)) return null

  const hasVisibleOverlay = Array.from(editor.children).some((child) => (
    child !== input && child instanceof HTMLDivElement
  ))
  return hasVisibleOverlay ? editor : null
}

export function patchIronCalcEditorTextContrast(container: HTMLDivElement | null): void {
  if (!container) return

  for (const input of container.querySelectorAll<HTMLTextAreaElement>('textarea')) {
    const editor = visibleTextEditor(input)
    if (editor && editor.style.color !== NORMALIZED_IRONCALC_EDITOR_TEXT_COLOR) {
      editor.style.color = IRONCALC_EDITOR_TEXT_COLOR
    }
  }
}
