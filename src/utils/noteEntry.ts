import type { VaultEntry } from '../types'
import { extractH1TitleFromContent } from './noteTitle'
import { notePathFilename } from './notePathIdentity'

/**
 * A Document opened on its own (no Folder, or outside the Folder) still has to
 * cross the Rust boundary, which confines every read and write to one root.
 * For such a Document that root is its own directory (ADR-0002).
 */
export function noteRootForPath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return separatorIndex > 0 ? path.slice(0, separatorIndex) : path
}

/** A Document is a `.md` file; an Image file is `imageFile.ts`'s to recognise. */
export function isDocumentPath(path: string): boolean {
  return /\.md$/iu.test(path)
}

function noteStem(filename: string): string {
  return filename.replace(/\.[^.]+$/u, '')
}

/**
 * The kernel's fat `VaultEntry` for a Document that was opened from a path
 * rather than listed by a Folder scan. Only the fields the editor reads are
 * meaningful; the rest carry Tolaria's defaults.
 */
export function noteEntryForPath(path: string, content: string): VaultEntry {
  const filename = notePathFilename(path)
  return {
    path,
    filename,
    title: noteStem(filename),
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: content.length,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: extractH1TitleFromContent(content) !== null,
    fileKind: 'markdown',
  }
}
