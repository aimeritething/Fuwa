import type { FolderNode } from '../types'

/**
 * In-memory Folder fixture: the stand-in for the Rust side when Fuwa runs in a
 * plain browser (`pnpm dev`, the Playwright smoke specs). It answers the
 * commands the shell needs to boot, list and edit from memory and rejects
 * everything else with the same message Tolaria's mock used, so a spec that
 * reaches an unanswered command fails loudly rather than silently.
 *
 * Extending it for a later spec: seed files through `createMockVault(seed)` or
 * `reset(seed)`, queue Finder-style opens with `queuePendingOpen`, and assert on
 * `calls` (every invocation in order). Add a case to the `answer` switch when a
 * spec needs a command the fixture does not answer yet. Like a real directory
 * tree, every ancestor folder of a seeded or saved path exists implicitly. Shapes follow the Rust commands:
 * absolute paths in, Folder-relative `/`-separated paths in `list_vault_folders`,
 * `modifiedAt` in seconds, errors as the Rust boundary's strings. `list_files`
 * and `take_pending_open` are Fuwa-owned and have no Rust side yet (spec
 * section 4 fixes only their fields), so their shapes here are the proposal the
 * Rust commands should match when they land.
 */

export const MOCK_VAULT_PATH = '/Users/fuwa/Documents/Notes'

export type MockVaultFileKind = 'note' | 'folder' | 'image'

export interface MockVaultFile {
  path: string
  kind: MockVaultFileKind
  /** Present for notes only. */
  content?: string
  /** Seconds since the epoch, as the Rust side reports it. */
  modifiedAt: number
  fileSize: number
}

export type MockVaultListing = Pick<MockVaultFile, 'path' | 'kind' | 'modifiedAt' | 'fileSize'>

export interface MockVaultCall {
  command: string
  args: Record<string, unknown> | undefined
}

export interface MockVaultCommands {
  list_files: { args: { vaultPath: string }; result: MockVaultListing[] }
  get_note_content: { args: { path: string; vaultPath?: string }; result: string }
  save_note_content: { args: { path: string; content: string; vaultPath?: string }; result: void }
  list_vault_folders: { args: { path: string }; result: FolderNode[] }
  start_vault_watcher: { args: { path: string }; result: void }
  stop_vault_watcher: { args?: undefined; result: void }
  take_pending_open: { args?: undefined; result: string[] }
}

export interface MockVault {
  readonly vaultPath: string
  readonly calls: MockVaultCall[]
  invoke<C extends keyof MockVaultCommands>(command: C, args?: MockVaultCommands[C]['args']): Promise<MockVaultCommands[C]['result']>
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  files(): MockVaultFile[]
  /** Write a note directly, without going through (or logging) a command. */
  writeNote(path: string, content: string): void
  watchedPath(): string | null
  queuePendingOpen(paths: string[]): void
  /** Restore the seed (or a new one), clear the watcher, the pending opens and the call log. */
  reset(seed?: MockVaultFile[]): void
}

declare global {
  interface Window {
    /** The fixture, installed by `installMockVault` in `./index` so specs can seed and inspect it. */
    __fuwaMockVault?: MockVault
  }
}

const ACTIVE_VAULT_PATH_ERROR = 'Path must stay inside the active vault'
const ACTIVE_VAULT_UNAVAILABLE_ERROR = 'Active vault is not available'
const FILE_DOES_NOT_EXIST_ERROR = 'File does not exist'
const NOT_A_NOTE_ERROR = 'Path is not a note'

export const DEFAULT_MOCK_VAULT_FILES: MockVaultFile[] = [
  file('Welcome.md', 'note', '# Welcome\n\nThis Folder lives in memory. Edits stay for the life of the page.\n', 1_757_500_000),
  file('Reading list.md', 'note', '# Reading list\n\n- [ ] A Philosophy of Software Design\n- [x] Practical Vim\n', 1_757_500_100),
  file('Projects', 'folder', undefined, 1_757_500_200),
  file('Projects/Fuwa.md', 'note', '---\ntitle: Fuwa\n---\n# Fuwa\n\nA small desktop app for Markdown files.\n', 1_757_500_300),
  file('Attachments', 'folder', undefined, 1_757_500_400),
  file('Attachments/lake.png', 'image', undefined, 1_757_500_500, 2_048),
]

function file(
  relativePath: string,
  kind: MockVaultFileKind,
  content: string | undefined,
  modifiedAt: number,
  fileSize = content?.length ?? 0,
): MockVaultFile {
  return { path: `${MOCK_VAULT_PATH}/${relativePath}`, kind, content, modifiedAt, fileSize }
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function isInsideVault(path: string, vaultPath: string): boolean {
  return path === vaultPath || path.startsWith(`${vaultPath}/`)
}

function listing({ path, kind, modifiedAt, fileSize }: MockVaultFile): MockVaultListing {
  return { path, kind, modifiedAt, fileSize }
}

/** The ancestor directories of `path` below the root, shallowest first. */
function ancestorFolders(path: string, vaultPath: string): string[] {
  const segments = path.slice(vaultPath.length + 1).split('/').slice(0, -1)
  return segments.map((_, index) => `${vaultPath}/${segments.slice(0, index + 1).join('/')}`)
}

function folderTree(files: MockVaultFile[], vaultPath: string): FolderNode[] {
  const byParent = new Map<string, FolderNode[]>()
  const folders = files
    .filter((entry) => entry.kind === 'folder')
    .map((entry) => entry.path.slice(vaultPath.length + 1))
    .sort((a, b) => a.localeCompare(b))

  for (const relativePath of folders) {
    const segments = relativePath.split('/')
    const parent = segments.slice(0, -1).join('/')
    const node: FolderNode = { name: segments[segments.length - 1], path: relativePath, children: [] }
    byParent.set(relativePath, node.children)
    const siblings = byParent.get(parent)
    if (siblings) siblings.push(node)
    else byParent.set(parent, [node])
  }

  return byParent.get('') ?? []
}

export function createMockVault(seed: MockVaultFile[] = DEFAULT_MOCK_VAULT_FILES): MockVault {
  const vaultPath = MOCK_VAULT_PATH
  let seedFiles = seed
  let files = new Map<string, MockVaultFile>()
  let watched: string | null = null
  let pendingOpen: string[] = []
  const calls: MockVaultCall[] = []

  function ensureFolders(path: string, modifiedAt: number): void {
    for (const folder of ancestorFolders(path, vaultPath)) {
      if (!files.has(folder)) files.set(folder, { path: folder, kind: 'folder', modifiedAt, fileSize: 0 })
    }
  }

  function reset(nextSeed: MockVaultFile[] = seedFiles): void {
    seedFiles = nextSeed
    files = new Map()
    for (const entry of nextSeed) {
      ensureFolders(entry.path, entry.modifiedAt)
      files.set(entry.path, { ...entry })
    }
    watched = null
    pendingOpen = []
    calls.length = 0
  }

  function requireRoot(candidate: unknown): void {
    if (candidate !== vaultPath) throw new Error(ACTIVE_VAULT_UNAVAILABLE_ERROR)
  }

  function requireInsideVault(candidate: unknown): string {
    if (typeof candidate !== 'string' || !isInsideVault(candidate, vaultPath)) {
      throw new Error(ACTIVE_VAULT_PATH_ERROR)
    }
    return candidate
  }

  function writeNote(candidate: unknown, content: string): void {
    const path = requireInsideVault(candidate)
    const existing = files.get(path)
    if (existing && existing.kind !== 'note') throw new Error(NOT_A_NOTE_ERROR)
    const modifiedAt = nowInSeconds()
    ensureFolders(path, modifiedAt)
    files.set(path, { path, kind: 'note', content, modifiedAt, fileSize: content.length })
  }

  function answer(command: string, args: Record<string, unknown> | undefined): unknown {
    switch (command) {
      case 'list_files': {
        requireRoot(args?.vaultPath)
        return Array.from(files.values(), listing)
      }
      case 'get_note_content': {
        const note = files.get(requireInsideVault(args?.path))
        if (note?.kind !== 'note') throw new Error(FILE_DOES_NOT_EXIST_ERROR)
        return note.content ?? ''
      }
      case 'save_note_content': {
        writeNote(args?.path, typeof args?.content === 'string' ? args.content : '')
        return undefined
      }
      case 'list_vault_folders': {
        requireRoot(args?.path)
        return folderTree(Array.from(files.values()), vaultPath)
      }
      case 'start_vault_watcher': {
        watched = requireInsideVault(args?.path)
        return undefined
      }
      case 'stop_vault_watcher': {
        watched = null
        return undefined
      }
      case 'take_pending_open': {
        const drained = pendingOpen
        pendingOpen = []
        return drained
      }
      default:
        throw new Error(`No mock handler for command: ${command}`)
    }
  }

  reset(seed)

  return {
    vaultPath,
    calls,
    async invoke(command: string, args?: Record<string, unknown>) {
      calls.push({ command, args })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the overloads carry the per-command type
      return answer(command, args) as any
    },
    files: () => Array.from(files.values(), (entry) => ({ ...entry })),
    writeNote,
    watchedPath: () => watched,
    queuePendingOpen: (paths) => {
      pendingOpen = [...pendingOpen, ...paths]
    },
    reset,
  }
}
