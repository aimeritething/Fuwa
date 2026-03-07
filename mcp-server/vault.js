/**
 * Vault operations — read-only helpers for Laputa markdown vault.
 * Write operations are handled by the agent's native bash/write/edit tools.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

/**
 * Recursively find all .md files under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function findMarkdownFiles(dir) {
  const results = []
  const items = await fs.readdir(dir, { withFileTypes: true })
  for (const item of items) {
    if (item.name.startsWith('.')) continue
    const full = path.join(dir, item.name)
    if (item.isDirectory()) {
      results.push(...await findMarkdownFiles(full))
    } else if (item.name.endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Read a note with parsed frontmatter and content.
 * @param {string} vaultPath
 * @param {string} notePath
 * @returns {Promise<{path: string, frontmatter: Record<string, unknown>, content: string}>}
 */
export async function getNote(vaultPath, notePath) {
  const absPath = path.isAbsolute(notePath) ? notePath : path.join(vaultPath, notePath)
  const raw = await fs.readFile(absPath, 'utf-8')
  const parsed = matter(raw)
  return {
    path: path.relative(vaultPath, absPath),
    frontmatter: parsed.data,
    content: parsed.content.trim(),
  }
}

/**
 * Search notes by title or content substring.
 * @param {string} vaultPath
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Promise<Array<{path: string, title: string, snippet: string}>>}
 */
export async function searchNotes(vaultPath, query, limit = 10) {
  const files = await findMarkdownFiles(vaultPath)
  const q = query.toLowerCase()
  const results = []

  for (const filePath of files) {
    if (results.length >= limit) break
    const content = await fs.readFile(filePath, 'utf-8')
    const filename = path.basename(filePath, '.md')

    const titleMatch = extractTitle(content, filename)
    const matches = titleMatch.toLowerCase().includes(q) || content.toLowerCase().includes(q)

    if (matches) {
      const snippet = extractSnippet(content, q)
      results.push({
        path: path.relative(vaultPath, filePath),
        title: titleMatch,
        snippet,
      })
    }
  }

  return results
}

/**
 * Get vault context: unique types, note count, top-level folders, and 20 most recent notes.
 * @param {string} vaultPath
 * @returns {Promise<{types: string[], noteCount: number, folders: string[], recentNotes: Array<{path: string, title: string, type: string|null}>, vaultPath: string}>}
 */
export async function vaultContext(vaultPath) {
  const files = await findMarkdownFiles(vaultPath)
  const typesSet = new Set()
  const foldersSet = new Set()
  const notesWithMtime = []

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(raw)
    const type = parsed.data.type || parsed.data.is_a || null
    if (type) typesSet.add(type)
    const rel = path.relative(vaultPath, filePath)
    const topFolder = rel.split(path.sep)[0]
    if (topFolder !== rel) foldersSet.add(topFolder + '/')
    const stat = await fs.stat(filePath)
    notesWithMtime.push({
      path: rel,
      title: parsed.data.title || extractTitle(raw, path.basename(filePath, '.md')),
      type,
      mtime: stat.mtimeMs,
    })
  }

  notesWithMtime.sort((a, b) => b.mtime - a.mtime)
  const recentNotes = notesWithMtime.slice(0, 20).map(({ mtime: _mtime, ...rest }) => rest)

  // Read config files for AI agent context
  const configFiles = {}
  try {
    const agentsPath = path.join(vaultPath, 'config', 'agents.md')
    const agentsContent = await fs.readFile(agentsPath, 'utf-8')
    configFiles.agents = agentsContent
  } catch {
    // config/agents.md may not exist yet
  }

  return {
    types: [...typesSet].sort(),
    noteCount: files.length,
    folders: [...foldersSet].sort(),
    recentNotes,
    configFiles,
    vaultPath,
  }
}

// --- Helpers ---

/**
 * Extract title from markdown content (first H1 or frontmatter title).
 * @param {string} content
 * @param {string} fallback
 * @returns {string}
 */
function extractTitle(content, fallback) {
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()

  const titleMatch = content.match(/^title:\s*(.+)$/m)
  if (titleMatch) return titleMatch[1].trim()

  return fallback
}

/**
 * Extract a snippet around the query match.
 * @param {string} content
 * @param {string} query
 * @returns {string}
 */
function extractSnippet(content, query) {
  const body = content.replace(/^---[\s\S]*?---\n?/, '').trim()
  const idx = body.toLowerCase().indexOf(query)
  if (idx === -1) return body.slice(0, 120)
  const start = Math.max(0, idx - 40)
  const end = Math.min(body.length, idx + query.length + 80)
  return (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '')
}
