import type { VaultEntry } from '../types'

/**
 * Detects whether the current window is a secondary "note window" (opened via
 * "Open in New Window") by inspecting URL query parameters.
 */

export interface NoteWindowParams {
  notePath: string
  vaultPath: string
  noteTitle: string
}

type NoteWindowPathContext = Pick<NoteWindowParams, 'notePath' | 'vaultPath'>

export function isNoteWindow(): boolean {
  return new URLSearchParams(window.location.search).get('window') === 'note'
}

export function getNoteWindowParams(): NoteWindowParams | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('window') !== 'note') return null
  const notePath = params.get('path')
  const vaultPath = params.get('vault')
  const noteTitle = params.get('title') ?? 'Untitled'
  if (!notePath || !vaultPath) return null
  return { notePath, vaultPath, noteTitle }
}

function trimTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '')
}

function stripKnownVaultPrefix({ notePath, vaultPath }: NoteWindowPathContext): string {
  const normalizedPath = trimTrailingSlash(notePath)
  const normalizedVaultPath = trimTrailingSlash(vaultPath)
  const vaultPrefix = `${normalizedVaultPath}/`

  if (normalizedVaultPath && normalizedPath.startsWith(vaultPrefix)) {
    return normalizedPath.slice(vaultPrefix.length)
  }

  const vaultName = normalizedVaultPath.split('/').pop()
  if (vaultName && normalizedPath.startsWith(`${vaultName}/`)) {
    return normalizedPath.slice(vaultName.length + 1)
  }

  return normalizedPath.replace(/^\/+/, '')
}

export function getNoteWindowPathCandidates({ notePath, vaultPath }: NoteWindowPathContext): string[] {
  const normalizedPath = trimTrailingSlash(notePath)
  const normalizedVaultPath = trimTrailingSlash(vaultPath)
  const relativePath = stripKnownVaultPrefix({ notePath: normalizedPath, vaultPath: normalizedVaultPath })
  const candidates = new Set<string>([normalizedPath])

  if (normalizedVaultPath) {
    candidates.add(`${normalizedVaultPath}/${relativePath}`)
  }

  return [...candidates]
}

function pathsMatch(leftPath: string, rightPath: string): boolean {
  if (leftPath === rightPath) return true
  return leftPath.endsWith(`/${rightPath}`) || rightPath.endsWith(`/${leftPath}`)
}

function variantsOverlap(left: Set<string>, right: Set<string>): boolean {
  for (const leftVariant of left) {
    for (const rightVariant of right) {
      if (pathsMatch(leftVariant, rightVariant)) {
        return true
      }
    }
  }

  return false
}

export function findNoteWindowEntry(
  entries: VaultEntry[],
  pathContext: NoteWindowPathContext,
): VaultEntry | undefined {
  const targetVariants = new Set(getNoteWindowPathCandidates(pathContext))

  return entries.find((entry) => variantsOverlap(targetVariants, new Set(getNoteWindowPathCandidates({
    notePath: entry.path,
    vaultPath: pathContext.vaultPath,
  }))))
}
