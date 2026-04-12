import { useCallback, useEffect } from 'react'

interface UseAiPanelFocusArgs {
  inputRef: React.RefObject<HTMLDivElement | null>
  panelRef: React.RefObject<HTMLElement | null>
  isActive: boolean
  onClose: () => void
}

export function useAiPanelFocus({
  inputRef,
  panelRef,
  isActive,
  onClose,
}: UseAiPanelFocusArgs) {
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [inputRef])

  useEffect(() => {
    if (isActive) {
      panelRef.current?.focus()
      return
    }

    inputRef.current?.focus()
  }, [inputRef, isActive, panelRef])

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (!panelRef.current?.contains(document.activeElement)) return

    event.preventDefault()
    onClose()
  }, [onClose, panelRef])

  useEffect(() => {
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleEscape])
}
