import { useState, useCallback, useEffect } from 'react'
import { getVaultConfig, updateVaultConfigField, subscribeVaultConfig } from '../utils/vaultConfigStore'

function loadHiddenSections(): Set<string> {
  const fromConfig = getVaultConfig().hidden_sections
  if (fromConfig && fromConfig.length > 0) return new Set(fromConfig)
  // Fallback to localStorage during initial load
  try {
    const raw = localStorage.getItem('laputa-hidden-sections')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr as string[])
    }
  } catch { /* ignore */ }
  return new Set()
}

function saveHiddenSections(hidden: Set<string>): void {
  const arr = [...hidden]
  updateVaultConfigField('hidden_sections', arr.length > 0 ? arr : null)
}

export function useSectionVisibility() {
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(loadHiddenSections)

  // Re-sync when vault config becomes available
  useEffect(() => {
    return subscribeVaultConfig(() => {
      const sections = getVaultConfig().hidden_sections
      if (sections) setHiddenSections(new Set(sections))
    })
  }, [])

  const toggleSection = useCallback((type: string) => {
    setHiddenSections((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      saveHiddenSections(next)
      return next
    })
  }, [])

  const isSectionVisible = useCallback(
    (type: string) => !hiddenSections.has(type),
    [hiddenSections],
  )

  return { hiddenSections, toggleSection, isSectionVisible }
}
