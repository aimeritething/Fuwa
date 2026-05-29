import {
  trackNotePdfExportFailed,
  trackNotePdfExportStarted,
} from '../lib/productAnalytics'
import { isTauri } from '../mock-tauri'

export const NOTE_PDF_EXPORT_CLASS = 'tolaria-note-pdf-exporting'

const DEFAULT_CLEANUP_DELAY_MS = 30_000

export type NotePdfExportSource = 'breadcrumb' | 'app_command'
export type NotePdfExportFailureReason = 'print_unavailable' | 'print_error'

export class NotePdfExportUnavailableError extends Error {
  constructor() {
    super('The system print dialog is not available in this window.')
    this.name = 'NotePdfExportUnavailableError'
  }
}

interface NotePdfExportOptions {
  cleanupDelayMs?: number
  documentObject?: Document
  nativePrint?: () => Promise<void>
  print?: () => void | Promise<void>
  source: NotePdfExportSource
  windowObject?: Window
}

function waitForPrintStyles(windowObject: Window): Promise<void> {
  return new Promise((resolve) => {
    windowObject.requestAnimationFrame(() => {
      windowObject.requestAnimationFrame(() => resolve())
    })
  })
}

export function cleanupNotePdfExportPrintMode(documentObject: Document = document): void {
  documentObject.body?.classList.remove(NOTE_PDF_EXPORT_CLASS)
}

function schedulePrintModeCleanup(
  documentObject: Document,
  windowObject: Window,
  cleanupDelayMs: number,
): () => void {
  let cleaned = false
  let timeoutId: number | null = null

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    cleanupNotePdfExportPrintMode(documentObject)
    windowObject.removeEventListener('afterprint', cleanup)
    if (timeoutId !== null) windowObject.clearTimeout(timeoutId)
  }

  windowObject.addEventListener('afterprint', cleanup)
  timeoutId = windowObject.setTimeout(cleanup, cleanupDelayMs)
  return cleanup
}

function resolvePrintFunction(
  windowObject: Window,
  {
    nativePrint = printCurrentNativeWebview,
    print,
  }: Pick<NotePdfExportOptions, 'nativePrint' | 'print'>,
): (() => void | Promise<void>) | null {
  if (print) return print
  if (isTauri()) return nativePrint
  return typeof windowObject.print === 'function'
    ? () => windowObject.print()
    : null
}

async function printCurrentNativeWebview(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('print_current_webview')
}

export async function printActiveNoteAsPdf({
  cleanupDelayMs = DEFAULT_CLEANUP_DELAY_MS,
  documentObject = document,
  nativePrint,
  print,
  source,
  windowObject = window,
}: NotePdfExportOptions): Promise<void> {
  const printDocument = resolvePrintFunction(windowObject, { nativePrint, print })
  if (!printDocument) {
    trackNotePdfExportFailed(source, 'print_unavailable')
    throw new NotePdfExportUnavailableError()
  }

  trackNotePdfExportStarted(source)
  documentObject.body.classList.add(NOTE_PDF_EXPORT_CLASS)
  const cleanup = schedulePrintModeCleanup(documentObject, windowObject, cleanupDelayMs)

  try {
    await waitForPrintStyles(windowObject)
    await printDocument()
  } catch (error) {
    cleanup()
    trackNotePdfExportFailed(source, 'print_error')
    throw error
  }
}
