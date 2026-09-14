import { useEffect, useEffectEvent } from 'react'
import { handleAppKeyboardEvent } from './app-keyboard-shortcuts'
import type { KeyboardActions } from './app-keyboard-shortcuts'

export type { KeyboardActions } from './app-keyboard-shortcuts'

export function useAppKeyboard(actions: KeyboardActions) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    handleAppKeyboardEvent(actions, event)
  })

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      onKeyDown(event)
    }

    window.addEventListener('keydown', handleWindowKeyDown, true)
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true)
  }, [])
}
