/**
 * Vault API detection and proxy for browser dev mode.
 * When a local vault API server is running, routes read and write commands
 * through it instead of returning hardcoded mock data.
 */

let vaultApiAvailable: boolean | null = null

async function detectVaultApiAvailability(): Promise<boolean> {
  try {
    const res = await fetch('/api/vault/ping', { signal: AbortSignal.timeout(500) })
    return res.ok
  } catch (error) {
    void error
    return false
  }
}

async function checkVaultApi(): Promise<boolean> {
  if (vaultApiAvailable === true) return true

  const available = await detectVaultApiAvailability()
  vaultApiAvailable = available
  console.info(`[mock-tauri] Vault API available: ${vaultApiAvailable}`)
  return available
}

interface VaultApiRequest {
  url: string
  method?: string
  body?: unknown
}

/** Tracks last vault path for commands that don't receive it as an argument. */
let lastVaultPath: string | null = null

type PathQueryCommand =
  | 'reload_vault_entry'
  | 'get_note_content'
  | 'validate_note_content'
  | 'get_all_content'

function argText(args: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(args, key)
  return value ? String(value) : null
}

function buildListRequest(args: Record<string, unknown>, reload: boolean): VaultApiRequest | null {
  const path = argText(args, 'path')
  if (!path) return null

  lastVaultPath = path
  const reloadSuffix = reload ? '&reload=1' : ''
  return { url: `/api/vault/list?path=${encodeURIComponent(path)}${reloadSuffix}` }
}

function buildPathQueryRequest(args: Record<string, unknown>, endpoint: string): VaultApiRequest | null {
  const path = argText(args, 'path')
  return path ? { url: `${endpoint}?path=${encodeURIComponent(path)}` } : null
}

function buildRequiredPostRequest(required: unknown, url: string, body: unknown): VaultApiRequest | null {
  return required ? { url, method: 'POST', body } : null
}

function buildRequiredPathPostRequest(args: Record<string, unknown>, url: string, body: unknown): VaultApiRequest | null {
  return buildRequiredPostRequest(args.path, url, body)
}

function buildSearchRequest(args: Record<string, unknown>): VaultApiRequest | null {
  const query = argText(args, 'query')
  if (!query || !lastVaultPath) return null

  const mode = argText(args, 'mode') ?? 'all'
  return { url: `/api/vault/search?vault_path=${encodeURIComponent(lastVaultPath)}&query=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}` }
}

function isPathQueryCommand(cmd: string): cmd is PathQueryCommand {
  return cmd === 'reload_vault_entry'
    || cmd === 'get_note_content'
    || cmd === 'validate_note_content'
    || cmd === 'get_all_content'
}

function pathQueryEndpoint(command: PathQueryCommand): string {
  if (command === 'reload_vault_entry') return '/api/vault/entry'
  if (command === 'get_note_content') return '/api/vault/content'
  if (command === 'validate_note_content') return '/api/vault/content'
  return '/api/vault/all-content'
}

function buildPostRequest(cmd: string, args: Record<string, unknown>): VaultApiRequest | null {
  if (cmd === 'save_note_content') {
    return buildRequiredPathPostRequest(args, '/api/vault/save', {
      path: args.path,
      content: args.content,
    })
  }
  if (cmd === 'rename_note') {
    return buildRequiredPostRequest(args.old_path, '/api/vault/rename', {
      vault_path: args.vault_path,
      old_path: args.old_path,
      new_title: args.new_title,
    })
  }
  if (cmd === 'rename_note_filename') {
    return buildRequiredPostRequest(args.old_path, '/api/vault/rename-filename', {
      vault_path: args.vault_path,
      old_path: args.old_path,
      new_filename_stem: args.new_filename_stem,
    })
  }
  if (cmd === 'move_note_to_folder') {
    return buildRequiredPostRequest(args.old_path && args.folder_path, '/api/vault/move-to-folder', {
      vault_path: args.vault_path,
      old_path: args.old_path,
      folder_path: args.folder_path,
    })
  }
  if (cmd === 'delete_note') return buildRequiredPathPostRequest(args, '/api/vault/delete', { path: args.path })
  return null
}

function buildVaultApiRequest(cmd: string, args?: Record<string, unknown>): VaultApiRequest | null {
  if (!args) return null
  if (cmd === 'list_vault') return buildListRequest(args, false)
  if (cmd === 'reload_vault') return buildListRequest(args, true)
  if (cmd === 'search_vault') return buildSearchRequest(args)
  if (isPathQueryCommand(cmd)) return buildPathQueryRequest(args, pathQueryEndpoint(cmd))
  return buildPostRequest(cmd, args)
}

function buildFetchOptions(request: VaultApiRequest): RequestInit {
  if (!request.body) {
    return { method: request.method || 'GET' }
  }

  return {
    method: request.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request.body),
  }
}

function safeVaultApiPath(request: VaultApiRequest): string | null {
  const url = new URL(request.url, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/vault/')) return null
  return `${url.pathname}${url.search}`
}

async function fetchVaultApiResponse(request: VaultApiRequest) {
  const path = safeVaultApiPath(request)
  if (!path) return undefined
  const res = await fetch(path, buildFetchOptions(request))
  if (!res.ok) return undefined
  return res.json()
}

export async function tryVaultApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const request = buildVaultApiRequest(cmd, args)
  if (!request) return undefined
  if (!await checkVaultApi()) return undefined

  try {
    const data = await fetchVaultApiResponse(request)
    if (data === undefined) return undefined
    if (cmd === 'get_note_content') return data.content as T
    if (cmd === 'validate_note_content') return (data.content === args?.content) as T
    return data as T
  } catch (err) {
    console.warn(`[mock-tauri] Vault API call failed for ${cmd}, falling back to mock:`, err)
    return undefined
  }
}
