import type { VaultEntry } from '../types'
import { noteEntryForPath, noteRootForPath } from './noteEntry'
import { notePathFilename } from './notePathIdentity'
import { isPathInsideVaultRoot } from './vaultPathContainment'

export interface ListedFile {
  path: string
  kind: 'note' | 'folder' | 'image'
  modifiedAt: number | null
  fileSize: number
}

export interface ExplorerNode {
  path: string
  name: string
  kind: ListedFile['kind']
  entry?: VaultEntry
  children: ExplorerNode[]
}

export function documentLocation(path: string, folder?: string | null) {
  const insideFolder = Boolean(folder && isPathInsideVaultRoot(path, folder))
  const filename = notePathFilename(path)
  const parent = notePathFilename(noteRootForPath(path))
  const parents = insideFolder
    ? [notePathFilename(folder!), ...path.slice(folder!.replace(/\/+$/u, '').length + 1).split('/').slice(0, -1)]
    : [parent]
  return { insideFolder, filename, parent, parents }
}

export function documentRoot(path: string, folder?: string | null): string {
  return folder && isPathInsideVaultRoot(path, folder) ? folder : noteRootForPath(path)
}

/** Metadata is enough for the Explorer; the kernel reads Document content only on open. */
export function buildExplorerTree(folder: string, files: readonly ListedFile[]): ExplorerNode {
  const root: ExplorerNode = { path: folder, name: notePathFilename(folder) || folder, kind: 'folder', children: [] }
  const nodes = new Map<string, ExplorerNode>([[folder, root]])
  for (const file of files) {
    if (file.path === folder || !isPathInsideVaultRoot(file.path, folder)) continue
    nodes.set(file.path, {
      path: file.path,
      name: notePathFilename(file.path),
      kind: file.kind,
      children: [],
      ...(file.kind === 'folder' ? {} : { entry: {
        ...noteEntryForPath(file.path, ''),
        modifiedAt: file.modifiedAt,
        fileSize: file.fileSize,
        fileKind: file.kind === 'note' ? 'markdown' as const : 'binary' as const,
      } }),
    })
  }
  for (const node of nodes.values()) {
    if (node !== root) nodes.get(noteRootForPath(node.path))?.children.push(node)
  }
  for (const node of nodes.values()) {
    node.children.sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder')
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }
  return root
}

/** Whether a Document exists anywhere under the root; folders and Image files do not count (the empty-Folder state, spec section 2). */
export function holdsDocument(node: ExplorerNode): boolean {
  return node.kind === 'note' || node.children.some(holdsDocument)
}
