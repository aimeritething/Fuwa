function parseVaultPathList(rawValue) {
  if (!rawValue?.trim()) return []

  try {
    const parsed = JSON.parse(rawValue)
    if (Array.isArray(parsed)) return parsed.filter(value => typeof value === 'string')
  } catch {
    // Older clients only set VAULT_PATH; keep VAULT_PATHS strict JSON so paths
    // with platform separators are never split incorrectly.
  }

  return []
}

function uniqueVaultPaths(paths) {
  const seen = new Set()
  const unique = []
  for (const path of paths) {
    const trimmed = path.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}

export function requireVaultPaths(env = process.env) {
  const vaultPaths = uniqueVaultPaths([
    env.VAULT_PATH?.trim() ?? '',
    ...parseVaultPathList(env.VAULT_PATHS),
  ])
  if (vaultPaths.length === 0) {
    throw new Error('VAULT_PATH is required. Open a vault in Tolaria before starting MCP tools.')
  }
  return vaultPaths
}

export function requireVaultPath(env = process.env) {
  return requireVaultPaths(env)[0]
}
