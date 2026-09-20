import {
  useState, useEffect, useCallback, useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import { isImeKeyEvent } from '@/lib/ime-key-event'

export interface SidebarMenuPosition {
  x: number
  y: number
}

export interface SidebarContextMenuState<T> {
  target: T
  pos: SidebarMenuPosition
}

interface PointerMenuEvent {
  clientX: number
  clientY: number
  preventDefault?: () => void
  stopPropagation?: () => void
}

interface SidebarInlineRenameInputOptions {
  initialValue: string
  onCancel: () => void
  onSubmit: (value: string) => Promise<boolean> | boolean | undefined
  selectTextOnFocus?: boolean
}

export function getPointerMenuPosition(event: PointerMenuEvent): SidebarMenuPosition {
  return { x: event.clientX, y: event.clientY }
}

export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, isOpen, onClose])
}

export function useDismissableSidebarLayer<T extends HTMLElement>(
  ref: RefObject<T | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  useOutsideClick(ref, isOpen, onClose)

  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])
}

export function useSidebarContextMenu<T>() {
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState<T> | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  useDismissableSidebarLayer(contextMenuRef, !!contextMenu, closeContextMenu)

  const openContextMenuAt = useCallback((target: T, pos: SidebarMenuPosition) => {
    setContextMenu({ target, pos })
  }, [])

  const openContextMenuFromPointer = useCallback((target: T, event: PointerMenuEvent) => {
    event.preventDefault?.()
    event.stopPropagation?.()
    openContextMenuAt(target, getPointerMenuPosition(event))
  }, [openContextMenuAt])

  return {
    closeContextMenu,
    contextMenu,
    contextMenuRef,
    openContextMenuAt,
    openContextMenuFromPointer,
  }
}

export function useSidebarInlineRenameInput({
  initialValue,
  onCancel,
  onSubmit,
  selectTextOnFocus = true,
}: SidebarInlineRenameInputOptions) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (selectTextOnFocus) input.select()
  }, [selectTextOnFocus])

  const submitValue = useCallback(async () => {
    if (submittingRef.current) return false
    submittingRef.current = true
    try {
      return await onSubmit(value)
    } finally {
      submittingRef.current = false
    }
  }, [onSubmit, value])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    // Enter confirming a candidate is not Enter committing the name.
    if (isImeKeyEvent(event.nativeEvent)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void submitValue()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }, [onCancel, submitValue])

  return {
    handleKeyDown,
    inputRef,
    setValue,
    submitValue,
    value,
  }
}
