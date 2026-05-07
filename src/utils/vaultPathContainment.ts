function normalizeVaultContainmentPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function compareVaultContainmentPath(path: string, vaultPath: string): [string, string] {
  const normalizedPath = normalizeVaultContainmentPath(path)
  const normalizedVaultPath = normalizeVaultContainmentPath(vaultPath)
  const hasWindowsDrive = /^[a-z]:/i.test(normalizedPath) || /^[a-z]:/i.test(normalizedVaultPath)
  return hasWindowsDrive
    ? [normalizedPath.toLowerCase(), normalizedVaultPath.toLowerCase()]
    : [normalizedPath, normalizedVaultPath]
}

export function canWritePathToVault(path: string, vaultPath: string | readonly string[]): boolean {
  if (Array.isArray(vaultPath)) {
    return vaultPath.some((candidate) => canWritePathToVault(path, candidate))
  }
  const trimmedVaultPath = vaultPath.trim()
  if (!trimmedVaultPath) return true
  const [targetPath, rootPath] = compareVaultContainmentPath(path, trimmedVaultPath)
  if (!rootPath || !targetPath) return false
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}/`)
}
