import { useCallback, useEffect, useState } from 'react'

/**
 * The one toast in Fuwa: a refused drag-and-drop move, and a
 * refused Move to Trash. It says what happened and goes away on its own —
 * nothing here is ever answered, which is why the Write failure bar and its
 * prompt are a different thing entirely.
 *
 * The message is held with a serial number so the same words twice in a row
 * still restart the clock.
 */

export const TOAST_DURATION_MS = 4_000

interface ToastState {
  serial: number
  message: string
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string) => {
    setToast((current) => ({ serial: (current?.serial ?? 0) + 1, message }))
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast((current) => (current === toast ? null : current)), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return { toast: toast?.message ?? null, showToast }
}
