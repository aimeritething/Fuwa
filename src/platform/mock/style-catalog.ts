// The smoke specs' tsconfig reaches this file through the fixture's types, without Vite's.
/// <reference types="vite/client" />

/**
 * The style catalog: the Documents and pictures in `./style-catalog/`, which the
 * Folder fixture seeds under `Style catalog/` so every block the Kernel renders
 * is on screen while its styles are tuned. They are real files, so the same
 * directory opens as a Folder in `pnpm tauri dev`. Adding a Document or a
 * picture is dropping a file in; nothing here lists them by name.
 *
 * The globs sit behind `import.meta.env.DEV` so a production build carries
 * none of it. Pictures come inlined as data URLs, which is what the fixture
 * serves for an Image file; a Document's own `../images/…` reference is
 * answered by the dev server (`styleCatalogImages` in `vite.config.ts`).
 */

export const STYLE_CATALOG_FOLDER = 'Style catalog'

export interface StyleCatalogEntry {
  /** Relative to the Folder's root, `/`-separated. */
  relativePath: string
  /** Present for Documents. */
  content?: string
  /** Present for pictures. */
  dataUrl?: string
  fileSize: number
}

const documents: Record<string, string> = import.meta.env.DEV
  ? import.meta.glob('./style-catalog/**/*.md', { query: '?raw', import: 'default', eager: true })
  : {}

const pictures: Record<string, string> = import.meta.env.DEV
  ? import.meta.glob('./style-catalog/images/*', { query: '?inline', import: 'default', eager: true })
  : {}

function catalogPath(modulePath: string): string {
  return `${STYLE_CATALOG_FOLDER}/${modulePath.slice('./style-catalog/'.length)}`
}

/** The bytes behind a data URL, near enough for the size an Image file's Tab shows. */
function dataUrlSize(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return dataUrl.includes(';base64,') ? Math.floor(payload.length * 3 / 4) : decodeURIComponent(payload).length
}

export function styleCatalogEntries(): StyleCatalogEntry[] {
  return [
    ...Object.entries(documents).map(([path, content]) => ({
      relativePath: catalogPath(path),
      content,
      fileSize: content.length,
    })),
    ...Object.entries(pictures).map(([path, dataUrl]) => ({
      relativePath: catalogPath(path),
      dataUrl,
      fileSize: dataUrlSize(dataUrl),
    })),
  ].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}
