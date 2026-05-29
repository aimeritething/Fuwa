import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NOTE_PDF_EXPORT_CLASS,
  cleanupNotePdfExportPrintMode,
  printActiveNoteAsPdf,
} from './notePdfExport'
import {
  trackNotePdfExportFailed,
  trackNotePdfExportStarted,
} from '../lib/productAnalytics'

const tauriRuntimeMock = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: tauriRuntimeMock.isTauri,
}))

vi.mock('../lib/productAnalytics', () => ({
  trackNotePdfExportFailed: vi.fn(),
  trackNotePdfExportStarted: vi.fn(),
}))

let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  tauriRuntimeMock.isTauri.mockReturnValue(false)
  requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 1
  })
})

afterEach(() => {
  cleanupNotePdfExportPrintMode()
  vi.clearAllMocks()
  requestAnimationFrameSpy.mockRestore()
})

describe('note PDF export', () => {
  it('enables print-only mode before opening the system print dialog', async () => {
    const print = vi.fn()

    await printActiveNoteAsPdf({ print, source: 'breadcrumb' })

    expect(document.body).toHaveClass(NOTE_PDF_EXPORT_CLASS)
    expect(print).toHaveBeenCalledOnce()
    expect(trackNotePdfExportStarted).toHaveBeenCalledWith('breadcrumb')
  })

  it('uses native webview printing inside Tauri', async () => {
    tauriRuntimeMock.isTauri.mockReturnValue(true)
    const nativePrint = vi.fn().mockResolvedValue(undefined)

    await printActiveNoteAsPdf({ nativePrint, source: 'app_command' })

    expect(nativePrint).toHaveBeenCalledOnce()
    expect(trackNotePdfExportStarted).toHaveBeenCalledWith('app_command')
  })

  it('removes print-only mode after the native print lifecycle finishes', async () => {
    await printActiveNoteAsPdf({ print: vi.fn(), source: 'app_command' })

    window.dispatchEvent(new Event('afterprint'))

    expect(document.body).not.toHaveClass(NOTE_PDF_EXPORT_CLASS)
  })

  it('tracks and cleans up failed print attempts', async () => {
    const error = new Error('print failed')

    await expect(printActiveNoteAsPdf({
      print: () => { throw error },
      source: 'app_command',
    })).rejects.toThrow(error)

    expect(document.body).not.toHaveClass(NOTE_PDF_EXPORT_CLASS)
    expect(trackNotePdfExportFailed).toHaveBeenCalledWith('app_command', 'print_error')
  })
})
