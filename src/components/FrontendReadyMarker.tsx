import { useEffect } from 'react'
import { markFrontendReady } from '@/utils/frontendReady'
import { markStartupPhase } from '@/lib/startupPerformance'

export function FrontendReadyMarker() {
  useEffect(() => {
    markFrontendReady()
    markStartupPhase('react_shell')
  }, [])

  return null
}
