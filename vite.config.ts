/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import fs from 'fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import matter from 'gray-matter'

// --- Vault API middleware (dev only) ---

interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  archived: boolean
  trashed: boolean
  trashedAt: number | null
  modifiedAt: number | null
  createdAt: number | null
  fileSize: number
  snippet: string
  wordCount: number
  relationships: Record<string, string[]>
  icon: string | null
  color: string | null
  order: number | null
  sidebarLabel: string | null
  template: string | null
  sort: string | null
  view: string | null
  visible: boolean | null
  outgoingLinks: string[]
  properties: Record<string, string | number | boolean | null>
}

/** Extract all [[wiki-links]] from a string. */
function extractWikiLinks(value: string): string[] {
  const matches = value.match(/\[\[[^\]]+\]\]/g)
  return matches ?? []
}

/** Extract wiki-links from a frontmatter value (string or array of strings). */
function wikiLinksFromValue(value: unknown): string[] {
  if (typeof value === 'string') return extractWikiLinks(value)
  if (Array.isArray(value)) {
    return value.flatMap((v) => (typeof v === 'string' ? extractWikiLinks(v) : []))
  }
  return []
}

// Frontmatter keys that map to dedicated VaultEntry fields (skip in generic relationships)
const DEDICATED_KEYS = new Set([
  'aliases', 'is_a', 'is a', 'belongs_to', 'belongs to',
  'related_to', 'related to', 'status', 'title',
])

function parseMarkdownFile(filePath: string): VaultEntry | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const stats = fs.statSync(filePath)
    const { data: fm, content } = matter(raw)

    const filename = path.basename(filePath)
    const basename = filename.replace(/\.md$/, '')

    // Title: first H1 in body, or frontmatter title, or filename
    const h1Match = content.match(/^#\s+(.+)$/m)
    const title = (fm.title as string) || (h1Match ? h1Match[1].trim() : basename)

    // Helper to get a frontmatter string field (case-insensitive key)
    const getString = (...keys: string[]): string | null => {
      for (const k of keys) {
        for (const fk of Object.keys(fm)) {
          if (fk.toLowerCase() === k.toLowerCase() && typeof fm[fk] === 'string') {
            return fm[fk]
          }
        }
      }
      return null
    }

    // Helper to get a frontmatter array-of-strings field
    const getArray = (...keys: string[]): string[] => {
      for (const k of keys) {
        for (const fk of Object.keys(fm)) {
          if (fk.toLowerCase() === k.toLowerCase()) {
            const val = fm[fk]
            if (Array.isArray(val)) return val.map(String)
            if (typeof val === 'string') return [val]
          }
        }
      }
      return []
    }

    const aliases = getArray('aliases')
    const belongsToRaw = getArray('belongs_to', 'belongs to')
    const relatedToRaw = getArray('related_to', 'related to')
    const belongsTo = belongsToRaw.flatMap((v) => extractWikiLinks(v))
    const relatedTo = relatedToRaw.flatMap((v) => extractWikiLinks(v))

    // Created at from filesystem metadata (birthtime), not frontmatter
    const createdAt = stats.birthtimeMs

    // Snippet: first 200 chars of body after frontmatter, stripped of markdown
    const bodyText = content.replace(/^#+\s+.+$/gm, '').replace(/[\n\r]+/g, ' ').trim()
    const snippet = bodyText.slice(0, 200)

    // Generic relationships: any frontmatter key whose value contains wiki-links
    const relationships: Record<string, string[]> = {}
    for (const key of Object.keys(fm)) {
      if (DEDICATED_KEYS.has(key.toLowerCase())) continue
      const links = wikiLinksFromValue(fm[key])
      if (links.length > 0) {
        relationships[key] = links
      }
    }

    // Boolean field helper — handles both real booleans and YAML 1.1 string
    // variants ("Yes"/"yes"/"True"/"true") that js-yaml 4.x (YAML 1.2) leaves as strings.
    const getBool = (...keys: string[]): boolean | null => {
      for (const k of keys) {
        for (const fk of Object.keys(fm)) {
          if (fk.toLowerCase() === k.toLowerCase()) {
            const v = fm[fk]
            if (typeof v === 'boolean') return v
            if (typeof v === 'string') {
              const lc = v.toLowerCase()
              if (lc === 'true' || lc === 'yes') return true
              if (lc === 'false' || lc === 'no') return false
            }
          }
        }
      }
      return null
    }

    return {
      path: filePath,
      filename,
      title,
      isA: getString('is_a', 'is a', 'type'),
      aliases,
      belongsTo,
      relatedTo,
      status: getString('status'),
      archived: getBool('archived') ?? false,
      trashed: getBool('trashed') ?? false,
      trashedAt: null,
      modifiedAt: stats.mtimeMs,
      createdAt,
      fileSize: stats.size,
      snippet,
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      relationships,
      icon: getString('icon'),
      color: getString('color'),
      order: fm.order != null ? Number(fm.order) : null,
      sidebarLabel: getString('sidebar label', 'sidebar_label'),
      template: getString('template'),
      sort: getString('sort'),
      view: getString('view'),
      visible: getBool('visible'),
      outgoingLinks: [],
      properties: {},
    }
  } catch {
    return null
  }
}

/** Recursively find all .md files under a directory. */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue
      const full = path.join(dir, item.name)
      if (item.isDirectory()) {
        results.push(...findMarkdownFiles(full))
      } else if (item.name.endsWith('.md')) {
        results.push(full)
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results
}

function sendJson(res: ServerResponse, payload: unknown, statusCode = 200): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function readExistingQueryPath(url: URL, res: ServerResponse, key: string): string | null {
  const filePath = url.searchParams.get(key)
  if (!filePath || !fs.existsSync(filePath)) {
    sendJson(res, { error: 'Invalid or missing path' }, 400)
    return null
  }
  return filePath
}

function updateTitleWikilinks(vaultPath: string, oldTitle: string, newTitle: string, excludePath: string): number {
  if (!oldTitle) return 0
  const allFiles = findMarkdownFiles(vaultPath)
  const escaped = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\[\\[${escaped}(\\|[^\\]]*?)?\\]\\]`, 'g')
  let updatedFiles = 0
  for (const filePath of allFiles) {
    if (filePath === excludePath) continue
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const replaced = content.replace(pattern, (_m: string, pipe: string | undefined) =>
        pipe ? `[[${newTitle}${pipe}]]` : `[[${newTitle}]]`
      )
      if (replaced !== content) {
        fs.writeFileSync(filePath, replaced, 'utf-8')
        updatedFiles++
      }
    } catch {
      // Skip unreadable files in the dev vault API.
    }
  }
  return updatedFiles
}

function updatePathWikilinks(vaultPath: string, oldPath: string, newPath: string): number {
  const oldRelativeStem = path.relative(vaultPath, oldPath).replace(/\.md$/i, '')
  const newRelativeStem = path.relative(vaultPath, newPath).replace(/\.md$/i, '')
  const escaped = oldRelativeStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\[\\[${escaped}(\\|[^\\]]*?)?\\]\\]`, 'g')
  let updatedFiles = 0
  for (const filePath of findMarkdownFiles(vaultPath)) {
    if (filePath === newPath) continue
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const replaced = content.replace(pattern, (_m: string, pipe: string | undefined) =>
        pipe ? `[[${newRelativeStem}${pipe}]]` : `[[${newRelativeStem}]]`
      )
      if (replaced !== content) {
        fs.writeFileSync(filePath, replaced, 'utf-8')
        updatedFiles++
      }
    } catch {
      // Skip unreadable files in the dev vault API.
    }
  }
  return updatedFiles
}

function handleVaultPing(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/ping') return false
  sendJson(res, { ok: true })
  return true
}

function handleVaultList(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/list') return false
  const dirPath = readExistingQueryPath(url, res, 'path')
  if (!dirPath) return true
  const entries = findMarkdownFiles(dirPath).map(parseMarkdownFile).filter(Boolean)
  sendJson(res, entries)
  return true
}

function handleVaultContent(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/content') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  sendJson(res, { content: fs.readFileSync(filePath, 'utf-8') })
  return true
}

function handleVaultAllContent(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/all-content') return false
  const dirPath = readExistingQueryPath(url, res, 'path')
  if (!dirPath) return true
  const contentMap: Record<string, string> = {}
  for (const filePath of findMarkdownFiles(dirPath)) {
    try {
      contentMap[filePath] = fs.readFileSync(filePath, 'utf-8')
    } catch {
      // Skip unreadable files.
    }
  }
  sendJson(res, contentMap)
  return true
}

function handleVaultEntry(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/entry') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  sendJson(res, parseMarkdownFile(filePath))
  return true
}

function handleVaultSearch(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/search') return false
  const vaultPath = url.searchParams.get('vault_path')
  const query = (url.searchParams.get('query') ?? '').toLowerCase()
  const mode = url.searchParams.get('mode') ?? 'all'
  if (!vaultPath || !query) {
    sendJson(res, { results: [], elapsed_ms: 0, query, mode })
    return true
  }

  const results: { title: string; path: string; snippet: string; score: number; note_type: string | null }[] = []
  for (const filePath of findMarkdownFiles(vaultPath)) {
    const entry = parseMarkdownFile(filePath)
    if (!entry || entry.trashed) continue
    const raw = fs.readFileSync(filePath, 'utf-8')
    if (entry.title.toLowerCase().includes(query) || raw.toLowerCase().includes(query)) {
      results.push({ title: entry.title, path: entry.path, snippet: entry.snippet, score: 1.0, note_type: entry.isA })
    }
  }
  sendJson(res, { results: results.slice(0, 20), elapsed_ms: 1, query, mode })
  return true
}

async function handleVaultSave(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== '/api/vault/save' || req.method !== 'POST') return false
  try {
    const body = await readRequestBody(req)
    const { path: filePath, content } = JSON.parse(body)
    if (!filePath || content === undefined) {
      sendJson(res, { error: 'Missing path or content' }, 400)
      return true
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    sendJson(res, null)
  } catch (err: unknown) {
    sendJson(res, { error: err instanceof Error ? err.message : 'Save failed' }, 500)
  }
  return true
}

async function handleVaultRename(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== '/api/vault/rename' || req.method !== 'POST') return false
  try {
    const body = await readRequestBody(req)
    const { vault_path: vaultPath, old_path: oldPath, new_title: newTitle } = JSON.parse(body)
    const oldContent = fs.readFileSync(oldPath, 'utf-8')
    const oldTitle = oldContent.match(/^# (.+)$/m)?.[1]?.trim() ?? ''
    const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const newPath = path.join(path.dirname(oldPath), `${slug}.md`)
    const newContent = oldContent.replace(/^# .+$/m, `# ${newTitle}`)

    fs.writeFileSync(newPath, newContent, 'utf-8')
    if (newPath !== oldPath) fs.unlinkSync(oldPath)

    const updatedFiles = vaultPath ? updateTitleWikilinks(vaultPath, oldTitle, newTitle, newPath) : 0
    sendJson(res, { new_path: newPath, updated_files: updatedFiles })
  } catch (err: unknown) {
    sendJson(res, { error: err instanceof Error ? err.message : 'Rename failed' }, 500)
  }
  return true
}

async function handleVaultRenameFilename(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== '/api/vault/rename-filename' || req.method !== 'POST') return false
  try {
    const body = await readRequestBody(req)
    const {
      vault_path: vaultPath,
      old_path: oldPath,
      new_filename_stem: newFilenameStem,
    } = JSON.parse(body)
    const trimmed = String(newFilenameStem ?? '').trim().replace(/\.md$/i, '').trim()
    if (!trimmed) {
      sendJson(res, { error: 'New filename cannot be empty' }, 400)
      return true
    }
    if (trimmed === '.' || trimmed === '..' || trimmed.includes('/') || trimmed.includes('\\')) {
      sendJson(res, { error: 'Invalid filename' }, 400)
      return true
    }

    const newPath = path.join(path.dirname(oldPath), `${trimmed}.md`)
    if (newPath !== oldPath && fs.existsSync(newPath)) {
      sendJson(res, { error: 'A note with that name already exists' }, 409)
      return true
    }

    fs.renameSync(oldPath, newPath)
    const updatedFiles = vaultPath ? updatePathWikilinks(vaultPath, oldPath, newPath) : 0
    sendJson(res, { new_path: newPath, updated_files: updatedFiles })
  } catch (err: unknown) {
    sendJson(res, { error: err instanceof Error ? err.message : 'Rename failed' }, 500)
  }
  return true
}

async function handleVaultDelete(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== '/api/vault/delete' || req.method !== 'POST') return false
  try {
    const body = await readRequestBody(req)
    const { path: filePath } = JSON.parse(body)
    if (!filePath) {
      sendJson(res, { error: 'Missing path' }, 400)
      return true
    }
    fs.unlinkSync(filePath)
    sendJson(res, filePath)
  } catch (err: unknown) {
    sendJson(res, { error: err instanceof Error ? err.message : 'Delete failed' }, 500)
  }
  return true
}

async function handleVaultApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  if (handleVaultPing(url, res)) return true
  if (handleVaultList(url, res)) return true
  if (handleVaultContent(url, res)) return true
  if (handleVaultAllContent(url, res)) return true
  if (handleVaultEntry(url, res)) return true
  if (handleVaultSearch(url, res)) return true
  if (await handleVaultSave(url, req, res)) return true
  if (await handleVaultRename(url, req, res)) return true
  if (await handleVaultRenameFilename(url, req, res)) return true
  if (await handleVaultDelete(url, req, res)) return true
  return false
}

function vaultApiPlugin(): Plugin {
  return {
    name: 'vault-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (await handleVaultApiRequest(req, res)) return
        next()
      })
    },
  }
}

// --- Proxy helpers ---

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

/** WebSocket proxy info endpoint — tells the frontend where the MCP bridge is */
function mcpBridgeInfoPlugin(): Plugin {
  return {
    name: 'mcp-bridge-info',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/mcp/info') return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          wsUrl: `ws://localhost:${process.env.MCP_WS_PORT || 9710}`,
          available: true,
        }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vaultApiPlugin(), mcpBridgeInfoPlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Inject the demo-vault-v2 path in local dev only — production Tauri builds and
  // CI must resolve the default vault path at runtime via the backend to avoid
  // baking the CI runner's absolute path into the distributed bundle.
  define: {
    ...(process.env.CI || (process.env.TAURI_PLATFORM && !process.env.TAURI_DEBUG)
      ? {}
      : { __DEMO_VAULT_PATH__: JSON.stringify(path.resolve(__dirname, 'demo-vault-v2')) }),
  },

  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects a fixed port
  server: {
    port: 5202,
    strictPort: true,
    allowedHosts: true,
  },

  // Env variables starting with TAURI_ are exposed to the frontend
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/mock-tauri.ts',
        'src/main.tsx',
        'src/types.ts',
        'src/hooks/useMcpBridge.ts',
        'src/hooks/useAiAgent.ts',
        'src/utils/ai-chat.ts',
        'src/utils/ai-agent.ts',
        'src/components/ui/dropdown-menu.tsx',
        'src/components/ui/scroll-area.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/separator.tsx',
        'src/components/ui/tabs.tsx',
        'src/components/ui/tooltip.tsx',
        'src/components/ui/card.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
