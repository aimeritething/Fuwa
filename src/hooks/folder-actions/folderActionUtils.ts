function trimTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path
}

export function folderAbsolutePath(params: { vaultPath: string; folderPath: string }): string {
  const normalizedVaultPath = trimTrailingSlash(params.vaultPath)
  const normalizedFolderPath = params.folderPath.replace(/^\/+/, '')
  return normalizedFolderPath ? `${normalizedVaultPath}/${normalizedFolderPath}` : normalizedVaultPath
}

export function isWithinPrefix(params: { path: string; prefix: string }): boolean {
  return params.path === params.prefix || params.path.startsWith(`${params.prefix}/`)
}

export function replaceFolderPrefix(params: {
  path: string
  oldPrefix: string
  newPrefix: string
}): string {
  if (!isWithinPrefix({ path: params.path, prefix: params.oldPrefix })) return params.path
  return `${params.newPrefix}${params.path.slice(params.oldPrefix.length)}`
}
