import { openLocalFile } from '@/platform/url'

/**
 * The Image Tab's hand-off. Plumo shows a picture and never edits it, so the
 * path row's job is to get the file to an app that can: Open ↗ through the
 * carried open-externally command, which the Rust boundary confines to the
 * given root. It is not a manifest command; it exists only here. Copy path is
 * the app command every Tab shares.
 */

export function openImageExternally(path: string, root: string): void {
  openLocalFile(path, root).catch((error: unknown) => {
    console.warn(`Could not open ${path} with the default app:`, error)
  })
}
