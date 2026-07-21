import { invoke } from '@tauri-apps/api/core'
import type { VaultOption } from '../components/StatusBar'
import type { FolderNode } from '../types'
import { isTauri, mockInvoke } from '../mock-tauri'
import { relativePathForVaultItem, vaultDeepLinkSlug } from '../utils/deepLinks'
import { joinVaultPath } from '../utils/notePathIdentity'
import {
  rankQuickLauncherResults,
  uniqueCaptureRelativePath,
  type QuickLauncherMatchCategory,
  type QuickLauncherSearchResult,
} from './quickLauncher'

interface NativeSearchResult {
  match_category?: QuickLauncherMatchCategory
  path: string
  relative_path?: string
  score: number
  snippet: string
  title: string
}

interface NativeSearchResponse {
  results: NativeSearchResult[]
}

interface SearchQuickLauncherInput {
  query: string
  scopePath: string | null
  vaults: readonly VaultOption[]
}

export interface QuickLauncherSearchResponse {
  failedVaultLabels: string[]
  results: QuickLauncherSearchResult[]
}

interface CreateQuickCaptureInput {
  body: string
  folder: string
  title: string
  vaultPath: string
}

interface CreatedQuickCapture {
  absolutePath: string
  collided: boolean
  relativePath: string
}

function usesAtomicQuickLauncherCreation({ body, folder }: Pick<CreateQuickCaptureInput, 'body' | 'folder'>): boolean {
  return isTauri() && !body.trim() && !folder.trim()
}

export interface QuickCapturePreview extends CreatedQuickCapture {
  collidingAbsolutePath: string | null
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

function searchableVaults({ vaults, scopePath }: Pick<SearchQuickLauncherInput, 'scopePath' | 'vaults'>): VaultOption[] {
  return vaults.filter((vault) => vault.available !== false
    && vault.mounted !== false
    && vault.searchEnabled !== false
    && (!scopePath || vault.path === scopePath))
}

function resultRelativePath({ result, vaultPath }: { result: NativeSearchResult; vaultPath: string }): string {
  return result.relative_path
    ?? relativePathForVaultItem({ itemPath: result.path, vaultPath })
    ?? result.path
}

async function searchVault({
  allVaults,
  query,
  vault,
}: {
  allVaults: readonly VaultOption[]
  query: string
  vault: VaultOption
}) {
  const response = await tauriCall<NativeSearchResponse>('search_vault', {
    excludeFrontmatter: false,
    limit: 25,
    query,
    vaultPath: vault.path,
  })
  const vaultId = vaultDeepLinkSlug(vault, allVaults)
  return response.results.map((result): QuickLauncherSearchResult => ({
    absolutePath: result.path,
    matchCategory: result.match_category ?? 'body',
    relativePath: resultRelativePath({ result, vaultPath: vault.path }),
    score: result.score,
    snippet: result.snippet,
    title: result.title,
    vaultId,
    vaultLabel: vault.label,
    vaultPath: vault.path,
  }))
}

export async function searchQuickLauncherVaults({
  query,
  scopePath,
  vaults,
}: SearchQuickLauncherInput): Promise<QuickLauncherSearchResponse> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return { failedVaultLabels: [], results: [] }
  const targets = searchableVaults({ scopePath, vaults })
  const settled = await Promise.allSettled(
    targets.map((vault) => searchVault({ allVaults: vaults, query: trimmedQuery, vault })),
  )
  const failedVaultLabels = targets
    .filter((_, index) => settled[index]?.status === 'rejected')
    .map((vault) => vault.label)
  const results = settled.flatMap((outcome) => outcome.status === 'fulfilled' ? outcome.value : [])
  return { failedVaultLabels, results: rankQuickLauncherResults(results) }
}

function relativeEntryPath({ path, vaultPath }: { path: string; vaultPath: string }): string {
  const relative = relativePathForVaultItem({ itemPath: path, vaultPath })
  if (relative) return relative
  return path.replace(/^\/+/, '')
}

function captureContent({ title, body }: Pick<CreateQuickCaptureInput, 'body' | 'title'>): string {
  const trimmedBody = body.trim()
  return `# ${title.trim()}\n${trimmedBody ? `\n${trimmedBody}\n` : ''}`
}

export async function createQuickCapture({
  body,
  folder,
  title,
  vaultPath,
}: CreateQuickCaptureInput): Promise<CreatedQuickCapture> {
  if (usesAtomicQuickLauncherCreation({ body, folder })) {
    return invoke<CreatedQuickCapture>('create_quick_launcher_note', { title, vaultPath })
  }

  const entries = await tauriCall<Array<{ path: string }>>('list_vault', { path: vaultPath })
  const existingRelativePaths = entries.map((entry) => relativeEntryPath({ path: entry.path, vaultPath }))
  const destination = uniqueCaptureRelativePath({ existingRelativePaths, folder, title })
  const absolutePath = joinVaultPath(vaultPath, destination.relativePath)
  await tauriCall<void>('create_note_content', {
    content: captureContent({ title, body }),
    path: absolutePath,
    vaultPath,
  })
  return { absolutePath, ...destination }
}

export async function previewQuickCapture({
  folder,
  title,
  vaultPath,
}: Omit<CreateQuickCaptureInput, 'body'>): Promise<QuickCapturePreview> {
  const entries = await tauriCall<Array<{ path: string }>>('list_vault', { path: vaultPath })
  const existingRelativePaths = entries.map((entry) => relativeEntryPath({ path: entry.path, vaultPath }))
  const initial = uniqueCaptureRelativePath({ existingRelativePaths: [], folder, title })
  const destination = uniqueCaptureRelativePath({ existingRelativePaths, folder, title })
  return {
    absolutePath: joinVaultPath(vaultPath, destination.relativePath),
    collided: destination.collided,
    collidingAbsolutePath: destination.collided
      ? joinVaultPath(vaultPath, initial.relativePath)
      : null,
    relativePath: destination.relativePath,
  }
}

export async function loadQuickCaptureFolders({ vaultPath }: { vaultPath: string }): Promise<FolderNode[]> {
  return tauriCall<FolderNode[]>('list_vault_folders', { path: vaultPath })
}
