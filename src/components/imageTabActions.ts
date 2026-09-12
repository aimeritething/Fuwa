import { copyLocalPath, openLocalFile } from '../utils/url'

/**
 * The Image Tab's two hand-offs. Fuwa shows a picture and
 * never edits it, so the path row's job is to get the file to an app that
 * can: Open ↗ through the carried open-externally command, which the Rust
 * boundary confines to the given root, and Copy path, which puts the absolute
 * path on the clipboard. Neither is a manifest command; they exist only here.
 */

export function openImageExternally(path: string, root: string): void {
  openLocalFile(path, root).catch((error: unknown) => {
    console.warn(`Could not open ${path} with the default app:`, error)
  })
}

export function copyImagePath(path: string): void {
  copyLocalPath(path).catch((error: unknown) => {
    console.warn(`Could not copy ${path} to the clipboard:`, error)
  })
}
