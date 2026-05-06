import { canWritePathToVault } from './vaultPathContainment'

const ASSET_URL_PREFIXES = [
  'asset://localhost/',
  'http://asset.localhost/',
  'asset://',
]
const RELATIVE_ATTACHMENTS_PREFIX = 'attachments/'
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/

type StringValueRequest = {
  value: string
}

type PathRequest = {
  path: string
}

type UrlRequest = {
  url: string
}

export type VaultAttachmentPathRequest = UrlRequest & {
  vaultPath?: string
}

export type VaultAttachmentUrlRequest = Pick<VaultAttachmentPathRequest, 'url'>

function safeDecode({ value }: StringValueRequest): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function hasUnsafeRelativeSegment({ path }: PathRequest): boolean {
  return path.split(/[\\/]/u).some(segment => segment === '..')
}

function usesWindowsSeparators({ path }: PathRequest): boolean {
  return WINDOWS_DRIVE_PATH_PATTERN.test(path) || path.startsWith('\\\\')
}

function joinVaultPath({
  relativePath,
  vaultPath,
}: {
  relativePath: string
  vaultPath: string
}): string {
  const separator = usesWindowsSeparators({ path: vaultPath }) ? '\\' : '/'
  const normalizedRelativePath = usesWindowsSeparators({ path: vaultPath })
    ? relativePath.replace(/\//g, '\\')
    : relativePath.replace(/\\/g, '/')
  const joiner = vaultPath.endsWith('/') || vaultPath.endsWith('\\') ? '' : separator
  return `${vaultPath}${joiner}${normalizedRelativePath}`
}

function assetUrlPrefix({ url }: UrlRequest): string | null {
  return ASSET_URL_PREFIXES.find(prefix => url.startsWith(prefix)) ?? null
}

function restoreUnixRoot({ path }: PathRequest): string {
  if (isRootedPath({ path })) return path
  return `/${path}`
}

function resolveAssetPath({ url }: UrlRequest): string | null {
  const prefix = assetUrlPrefix({ url })
  if (!prefix) return null
  return restoreUnixRoot({ path: safeDecode({ value: url.slice(prefix.length) }) })
}

function isRootedPath({ path }: PathRequest): boolean {
  if (path.startsWith('/')) return true
  if (WINDOWS_DRIVE_PATH_PATTERN.test(path)) return true
  return path.startsWith('\\\\')
}

function resolveRelativeAttachmentPath({
  url,
  vaultPath,
}: {
  url: string
  vaultPath: string
}): string | null {
  if (!url.startsWith(RELATIVE_ATTACHMENTS_PREFIX)) return null

  const relativePath = safeDecode({ value: url })
  if (hasUnsafeRelativeSegment({ path: relativePath })) return null
  return joinVaultPath({ vaultPath, relativePath })
}

export function isVaultAttachmentUrl({ url }: VaultAttachmentUrlRequest): boolean {
  const trimmedUrl = url.trim()
  return trimmedUrl.startsWith(RELATIVE_ATTACHMENTS_PREFIX)
    || assetUrlPrefix({ url: trimmedUrl }) !== null
}

export function resolveVaultAttachmentPath({
  url,
  vaultPath,
}: VaultAttachmentPathRequest): string | null {
  const trimmedVaultPath = vaultPath?.trim()
  if (!trimmedVaultPath) return null

  const trimmedUrl = url.trim()
  if (!trimmedUrl) return null

  const candidatePath = resolveRelativeAttachmentPath({
    url: trimmedUrl,
    vaultPath: trimmedVaultPath,
  })
    ?? resolveAssetPath({ url: trimmedUrl })
    ?? trimmedUrl

  return canWritePathToVault(candidatePath, trimmedVaultPath) ? candidatePath : null
}
