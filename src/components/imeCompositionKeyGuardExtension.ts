import { createExtension } from '@blocknote/core'
import { SuggestionMenu } from '@blocknote/core/extensions'
import {
  activeRichEditorView,
  isComposingKeyboardEvent,
  type ComposingEditorView,
} from './richEditorKeyboard'

const COMPOSITION_SETTLE_WINDOW_MS = 500

function isEnterKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter'
    || event.code === 'Enter'
    || event.code === 'NumpadEnter'
    || event.keyCode === 13
}

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.key === ' '
    || event.code === 'Space'
    || event.keyCode === 32
}

function isCompositionEditorShortcutKey(event: KeyboardEvent): boolean {
  return isEnterKey(event) || isSpaceKey(event)
}

function isParagraphInput(event: InputEvent): boolean {
  return event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak'
}

function composedSlashCommandRange(data: string, view: ReturnType<typeof activeRichEditorView>) {
  if (!view?.state.selection.empty) return null

  const slashIndex = data.lastIndexOf('/')
  if (slashIndex < 0) return null

  const command = data.slice(slashIndex)
  if (command.includes('\n')) return null

  const to = view.state.selection.from
  const from = to - command.length
  if (from < 1 || view.state.doc.textBetween(from, to) !== command) return null

  return { from, query: command.slice(1), to }
}

export function shouldStopComposingEditorShortcutKey(
  event: KeyboardEvent,
  view?: ComposingEditorView | null,
  compositionActive = false,
): boolean {
  return isCompositionEditorShortcutKey(event)
    && (compositionActive || isComposingKeyboardEvent(event, view))
}

export function shouldStopComposingParagraphInput(
  event: InputEvent,
  view?: ComposingEditorView | null,
  composingEnterAt: number | null = null,
): boolean {
  if (!isParagraphInput(event)) return false
  if (event.isComposing || view?.composing === true) return true
  if (composingEnterAt === null) return false

  const elapsed = event.timeStamp - composingEnterAt
  return elapsed >= 0 && elapsed < COMPOSITION_SETTLE_WINDOW_MS
}

export const createImeCompositionKeyGuardExtension = createExtension(({ editor }) => {
  const readView = () => activeRichEditorView(editor)
  let compositionActive = false
  let composingEnterAt: number | null = null

  const reopenComposedSlashCommand = (data: string) => {
    const suggestionMenu = editor.getExtension(SuggestionMenu)
    if (!suggestionMenu || suggestionMenu.shown()) return

    const view = readView()
    const command = composedSlashCommandRange(data, view)
    if (!view || !command) return

    view.dispatch(view.state.tr.delete(command.from, command.to))
    suggestionMenu.openSuggestionMenu('/', { deleteTriggerCharacter: true })

    const updatedView = readView()
    if (command.query && updatedView) {
      updatedView.dispatch(updatedView.state.tr.insertText(command.query))
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!shouldStopComposingEditorShortcutKey(event, readView(), compositionActive)) {
      composingEnterAt = null
      return
    }

    if (isEnterKey(event)) composingEnterAt = event.timeStamp
    event.stopImmediatePropagation()
  }

  const handleCompositionStart = () => {
    compositionActive = true
  }

  const handleCompositionEnd = (event: CompositionEvent) => {
    compositionActive = false
    if (composingEnterAt !== null) composingEnterAt = event.timeStamp
    if (event.data) setTimeout(() => reopenComposedSlashCommand(event.data), 0)
  }

  const handleBeforeInput = (event: InputEvent) => {
    if (!isParagraphInput(event)) return
    if (!shouldStopComposingParagraphInput(event, readView(), composingEnterAt)) {
      composingEnterAt = null
      return
    }

    composingEnterAt = null
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  return {
    key: 'imeCompositionKeyGuard',
    mount: ({ dom, signal }) => {
      dom.addEventListener('keydown', handleKeyDown, {
        capture: true,
        signal,
      })
      dom.addEventListener('compositionstart', handleCompositionStart, {
        capture: true,
        signal,
      })
      dom.addEventListener('compositionend', handleCompositionEnd, {
        capture: true,
        signal,
      })
      dom.addEventListener('beforeinput', handleBeforeInput as EventListener, {
        capture: true,
        signal,
      })
    },
  } as const
})
