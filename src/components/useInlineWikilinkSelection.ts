import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  applySelectionIndex,
  readSelectionIndex,
  serializeInlineNode,
} from './inlineWikilinkDom'
import { normalizeInlineWikilinkValue } from './inlineWikilinkTokens'

interface UseInlineWikilinkSelectionArgs {
  value: string
  onChange: (value: string) => void
  inputRef?: React.RefObject<HTMLDivElement | null>
}

export function useInlineWikilinkSelection({
  value,
  onChange,
  inputRef,
}: UseInlineWikilinkSelectionArgs) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [selectionIndex, setSelectionIndex] = useState(value.length)

  const setCombinedRef = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node
    if (inputRef) {
      inputRef.current = node
    }
  }, [inputRef])

  const syncSelectionIndex = useCallback(() => {
    if (!editorRef.current) return
    setSelectionIndex(readSelectionIndex(editorRef.current))
  }, [])

  const focusSelectionAt = useCallback((nextSelectionIndex: number) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    applySelectionIndex(editor, nextSelectionIndex)
  }, [])

  const commitValueFromEditor = useCallback(() => {
    if (!editorRef.current) return

    const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editorRef.current))
    const nextSelectionIndex = readSelectionIndex(editorRef.current)

    onChange(nextValue)
    setSelectionIndex(Math.min(nextSelectionIndex, nextValue.length))
  }, [onChange])

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement !== editor) return
    applySelectionIndex(editor, selectionIndex)
  }, [selectionIndex, value])

  return {
    selectionIndex,
    setSelectionIndex,
    setCombinedRef,
    syncSelectionIndex,
    focusSelectionAt,
    commitValueFromEditor,
  }
}
