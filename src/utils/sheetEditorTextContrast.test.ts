import { describe, expect, it } from 'vitest'
import { patchIronCalcEditorTextContrast } from './sheetEditorTextContrast'

function createIronCalcTextEditor() {
  const container = document.createElement('div')
  const editor = document.createElement('div')
  const overlay = document.createElement('div')
  const input = document.createElement('textarea')

  editor.style.backgroundColor = 'rgb(255, 255, 255)'
  editor.style.color = 'rgb(245, 245, 245)'
  input.style.backgroundColor = 'transparent'
  input.style.color = 'transparent'
  input.spellcheck = false
  overlay.textContent = 'Visible cell input'
  editor.append(overlay, input)
  container.append(editor)

  return { container, editor }
}

describe('sheet editor text contrast', () => {
  it('keeps IronCalc input text readable on its fixed white editor background', async () => {
    const { container, editor } = createIronCalcTextEditor()
    let styleMutations = 0
    const observer = new MutationObserver((mutations) => {
      styleMutations += mutations.length
    })
    observer.observe(editor, { attributeFilter: ['style'], attributes: true })

    patchIronCalcEditorTextContrast(container)
    await Promise.resolve()
    patchIronCalcEditorTextContrast(container)
    await Promise.resolve()

    expect(editor.style.color).toBe('rgb(17, 24, 39)')
    expect(styleMutations).toBe(1)
    observer.disconnect()
  })

  it('leaves unrelated textareas unchanged', () => {
    const container = document.createElement('div')
    const editor = document.createElement('div')
    const input = document.createElement('textarea')
    editor.style.color = 'rgb(245, 245, 245)'
    editor.append(input)
    container.append(editor)

    patchIronCalcEditorTextContrast(container)

    expect(editor.style.color).toBe('rgb(245, 245, 245)')
  })
})
