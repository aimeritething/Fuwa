import { documentRoot } from '@/folder/explorer'
import { openPathInDefaultApp, revealPath } from '@/folder/explorer-commands'

/**
 * The active Tab's file handed to macOS: Reveal in Finder and Open in Default
 * App, the File menu's commands, which the tab bar's "…" and an Image Tab's
 * Open ↗ run too. Either works on a Document or an Image file. Open in
 * Default App names the Tab's boundary root (its Folder, or a lone file's own
 * directory), since the Rust side refuses a path outside it. A refusal is
 * logged rather than thrown at the click: there is nothing on screen to undo.
 */

export function revealTabFile(path: string): void {
  revealPath(path).catch((error: unknown) => {
    console.warn(`Could not reveal ${path} in Finder:`, error)
  })
}

export function openTabFileInDefaultApp(path: string, folder: string | null): void {
  openPathInDefaultApp(path, documentRoot(path, folder)).catch((error: unknown) => {
    console.warn(`Could not open ${path} with the default app:`, error)
  })
}
