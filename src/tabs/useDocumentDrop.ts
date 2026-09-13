import { isDocumentPath } from '@/folder/noteEntry'
import { openNotesSettled } from './noteOpenRequest'
import { useTauriDragDropEvent, type TauriDragDropEvent } from '@/platform/useTauriDragDropEvent'

/**
 * A file dropped on the window arrives through Tauri's native drag-drop event,
 * never HTML5 `drop`: `dragDropEnabled` is on, and WKWebView then keeps external
 * file drops away from the page (ADR-0006). A dropped `.md` opens as a Document,
 * and one already open has its Tab activated (`openNote`'s own rule).
 *
 * Every other dropped file is ignored here without a word: an image over a
 * Document is the editor's image drop hook's (`useImageDrop`), and nothing else
 * is ever written into the Folder.
 */

interface UseDocumentDropOptions {
  /** Opens a Document, or activates its Tab when it is already open. */
  openNote: (path: string) => Promise<void>
  /** Writes the active Document's pending edits, as opening from the menu does. */
  settleActiveNote: () => Promise<void>
}

export function useDocumentDrop({ openNote, settleActiveNote }: UseDocumentDropOptions): void {
  useTauriDragDropEvent((event: TauriDragDropEvent) => {
    if (event.payload.type !== 'drop') return

    void openNotesSettled({
      openNote,
      paths: event.payload.paths.filter(isDocumentPath),
      settleActiveNote,
    })
  })
}
