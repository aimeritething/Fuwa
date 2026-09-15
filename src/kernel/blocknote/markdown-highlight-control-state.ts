import { useCallback, useEffect, useState } from 'react'
import { resolveEffectiveLocale, translate, type AppLocale } from '@/lib/i18n'
import {
  markdownHighlightColorOption,
  type MarkdownHighlightColor,
} from '@/kernel/markdown/markdown-highlight-markdown'
import type { HighlightEditor, MarkdownHighlightRange } from './markdown-highlight-model'
import { readMarkdownHighlightRange } from './markdown-highlight-range'

export type CursorControlState = MarkdownHighlightRange & {
  left: number
  top: number
}

function currentLocale(): AppLocale {
  return resolveEffectiveLocale(document.documentElement.lang)
}

export function colorLabel(locale: AppLocale, color: MarkdownHighlightColor): string {
  return translate(locale, markdownHighlightColorOption(color).localeKey)
}

export function useDocumentLocale(): AppLocale {
  const [locale, setLocale] = useState(currentLocale)

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(currentLocale()))
    observer.observe(document.documentElement, { attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  return locale
}

function readCursorControlState(editor: HighlightEditor): CursorControlState | null {
  const range = readMarkdownHighlightRange(editor)
  if (!range) return null

  try {
    const coordinates = editor.prosemirrorView.coordsAtPos(range.to)
    const left = Math.min(coordinates.right + 8, window.innerWidth - 32)
    const top = coordinates.top + (coordinates.bottom - coordinates.top) / 2
    return { ...range, left, top }
  } catch {
    return null
  }
}

export function useCursorControlState(editor: HighlightEditor): CursorControlState | null {
  const [state, setState] = useState(() => readCursorControlState(editor))
  const update = useCallback(() => setState(readCursorControlState(editor)), [editor])

  useEffect(() => {
    const unsubscribeChange = editor.onChange(update)
    const unsubscribeSelection = editor.onSelectionChange(update)
    window.addEventListener('resize', update)
    document.addEventListener('scroll', update, true)
    return () => {
      unsubscribeChange()
      unsubscribeSelection()
      window.removeEventListener('resize', update)
      document.removeEventListener('scroll', update, true)
    }
  }, [editor, update])

  return state
}
