import { useCallback, useEffect, useState, type MutableRefObject } from 'react'
import { translate, type AppLocale } from '../lib/i18n'
import { trackNotePdfExportFailed } from '../lib/productAnalytics'
import {
  printActiveNoteAsPdf,
  type NotePdfExportSource,
} from '../utils/notePdfExport'
import type { VaultEntry } from '../types'

interface EditorPdfExportTab {
  entry: VaultEntry
}

interface UseEditorPdfExportParams {
  activeTab: EditorPdfExportTab | null
  diffMode: boolean
  handleToggleDiffExclusive: () => void | Promise<void>
  handleToggleRawExclusive: () => void
  locale?: AppLocale
  onToast?: (message: string | null) => void
  pdfExportRef?: MutableRefObject<((source?: NotePdfExportSource) => void) | null>
  rawMode: boolean
}

function isMarkdownTab(activeTab: EditorPdfExportTab | null): boolean {
  return activeTab?.entry.fileKind === 'markdown'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useEditorPdfExport({
  activeTab,
  diffMode,
  handleToggleDiffExclusive,
  handleToggleRawExclusive,
  locale = 'en',
  onToast,
  pdfExportRef,
  rawMode,
}: UseEditorPdfExportParams): (source?: NotePdfExportSource) => void {
  const [pendingSource, setPendingSource] = useState<NotePdfExportSource | null>(null)

  const exportNoteAsPdf = useCallback((source: NotePdfExportSource = 'breadcrumb') => {
    if (!isMarkdownTab(activeTab)) {
      trackNotePdfExportFailed(source, 'print_unavailable')
      onToast?.(translate(locale, 'editor.exportPdf.unavailable'))
      return
    }

    const prepareExport = async () => {
      if (diffMode) await Promise.resolve(handleToggleDiffExclusive())
      if (rawMode) handleToggleRawExclusive()
      setPendingSource(source)
    }

    void prepareExport().catch((error) => {
      onToast?.(translate(locale, 'editor.exportPdf.failed', { error: errorMessage(error) }))
    })
  }, [activeTab, diffMode, handleToggleDiffExclusive, handleToggleRawExclusive, locale, onToast, rawMode])

  useEffect(() => {
    if (!pendingSource || diffMode || rawMode || !isMarkdownTab(activeTab)) return

    let cancelled = false

    void printActiveNoteAsPdf({ source: pendingSource })
      .catch((error) => {
        if (!cancelled) {
          onToast?.(translate(locale, 'editor.exportPdf.failed', { error: errorMessage(error) }))
        }
      })
      .finally(() => {
        if (!cancelled) setPendingSource(null)
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, diffMode, locale, onToast, pendingSource, rawMode])

  useEffect(() => {
    if (!pdfExportRef) return undefined

    pdfExportRef.current = exportNoteAsPdf
    return () => {
      if (pdfExportRef.current === exportNoteAsPdf) {
        pdfExportRef.current = null
      }
    }
  }, [exportNoteAsPdf, pdfExportRef])

  return exportNoteAsPdf
}
