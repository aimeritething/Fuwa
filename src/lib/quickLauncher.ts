import { slugifyNoteStem } from '../utils/noteSlug'

export interface QuickCaptureDestination {
  folder: string
  vaultPath: string
}

export interface QuickCaptureVault {
  available: boolean
  id: string
  label: string
  path: string
  writable: boolean
}

export type QuickCaptureDestinationSource = 'configured' | 'active' | 'last' | 'none'

export interface QuickCaptureDestinationResolution {
  destination: QuickCaptureDestination | null
  requiresAttention: boolean
  source: QuickCaptureDestinationSource
}

export type QuickLauncherMatchCategory = 'exact_title' | 'title' | 'path' | 'body'

export interface QuickLauncherSearchResult {
  absolutePath: string
  matchCategory: QuickLauncherMatchCategory
  relativePath: string
  score: number
  snippet: string
  title: string
  vaultId: string
  vaultLabel: string
  vaultPath: string
}

interface ResolveDestinationInput {
  active: QuickCaptureDestination | null
  configured: QuickCaptureDestination | null
  last: QuickCaptureDestination | null
  vaults: readonly QuickCaptureVault[]
}

function isWritableDestination(
  destination: QuickCaptureDestination | null,
  vaults: readonly QuickCaptureVault[],
): destination is QuickCaptureDestination {
  if (!destination) return false
  const vault = vaults.find((candidate) => candidate.path === destination.vaultPath)
  return Boolean(vault?.available && vault.writable)
}

export function resolveQuickCaptureDestination({
  active,
  configured,
  last,
  vaults,
}: ResolveDestinationInput): QuickCaptureDestinationResolution {
  if (configured) {
    return isWritableDestination(configured, vaults)
      ? { destination: configured, source: 'configured', requiresAttention: false }
      : { destination: null, source: 'configured', requiresAttention: true }
  }

  if (isWritableDestination(active, vaults)) {
    return { destination: active, source: 'active', requiresAttention: false }
  }
  if (isWritableDestination(last, vaults)) {
    return { destination: last, source: 'last', requiresAttention: false }
  }
  return { destination: null, source: 'none', requiresAttention: true }
}

export function quickLauncherResultId(result: QuickLauncherSearchResult): string {
  return `${result.vaultId}\n${result.relativePath}`
}

const MATCH_CATEGORY_RANK: Record<QuickLauncherMatchCategory, number> = {
  exact_title: 4,
  title: 3,
  path: 2,
  body: 1,
}

export function rankQuickLauncherResults(
  results: readonly QuickLauncherSearchResult[],
): QuickLauncherSearchResult[] {
  return [...results].sort((left, right) => {
    const categoryDifference = MATCH_CATEGORY_RANK[right.matchCategory]
      - MATCH_CATEGORY_RANK[left.matchCategory]
    if (categoryDifference !== 0) return categoryDifference
    if (right.score !== left.score) return right.score - left.score
    return quickLauncherResultId(left).localeCompare(quickLauncherResultId(right))
  })
}

function normalizedFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/gu, '')
}

function captureRelativePath(folder: string, stem: string): string {
  const filename = `${stem}.md`
  const safeFolder = normalizedFolder(folder)
  return safeFolder ? `${safeFolder}/${filename}` : filename
}

export function uniqueCaptureRelativePath({
  title,
  folder,
  existingRelativePaths,
}: {
  existingRelativePaths: readonly string[]
  folder: string
  title: string
}): { relativePath: string; collided: boolean } {
  const stem = slugifyNoteStem(title)
  const existing = new Set(existingRelativePaths.map((path) => path.toLocaleLowerCase()))
  const initialPath = captureRelativePath(folder, stem)
  if (!existing.has(initialPath.toLocaleLowerCase())) {
    return { relativePath: initialPath, collided: false }
  }

  let suffix = 2
  let relativePath = captureRelativePath(folder, `${stem}-${suffix}`)
  while (existing.has(relativePath.toLocaleLowerCase())) {
    suffix += 1
    relativePath = captureRelativePath(folder, `${stem}-${suffix}`)
  }
  return { relativePath, collided: true }
}
