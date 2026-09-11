import { DEFAULT_THEME_MODE, normalizeThemeMode, type ThemeMode } from '../lib/themeMode'
import { isImageFilePath } from './imageFile'

/**
 * The Session file (spec section 5): one `session.json` in the app's config
 * directory, restored on launch. This module is the schema. The Rust side
 * owns the file itself and the `window` frame, which it merges in when it
 * writes; the renderer sends everything else and never reads `window` back.
 *
 * `folder` roots the Explorer. `sidebar` stays at its default until sidebar
 * collapse lands; `theme` is the View → Appearance choice.
 */

export const SESSION_VERSION = 1

export type SessionEditorMode = 'rich' | 'raw'

export interface SessionEditor {
  path: string
  /** `rich | raw` for a Document; omitted for an Image file (kind derives from the extension). */
  mode?: SessionEditorMode
}

export interface SessionSidebar {
  collapsed: boolean
  width: number
}

export interface Session {
  version: typeof SESSION_VERSION
  folder: string | null
  /** Tab order. */
  openEditors: SessionEditor[]
  activePath: string | null
  theme: ThemeMode
  sidebar: SessionSidebar
}

export interface RestoredOpenEditors {
  openEditors: SessionEditor[]
  activePath: string | null
}

export const DEFAULT_SESSION_SIDEBAR: SessionSidebar = { collapsed: false, width: 260 }

const EDITOR_MODES = new Set<SessionEditorMode>(['rich', 'raw'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseEditor(value: unknown): SessionEditor | null {
  if (!isRecord(value) || typeof value.path !== 'string') return null
  const mode = typeof value.mode === 'string' && EDITOR_MODES.has(value.mode as SessionEditorMode)
    ? (value.mode as SessionEditorMode)
    : undefined
  return mode ? { path: value.path, mode } : { path: value.path }
}

function parseEditors(value: unknown): SessionEditor[] {
  if (!Array.isArray(value)) return []
  return value.map(parseEditor).filter((editor): editor is SessionEditor => editor !== null)
}

function parseSidebar(value: unknown): SessionSidebar {
  if (!isRecord(value)) return DEFAULT_SESSION_SIDEBAR
  return {
    collapsed: typeof value.collapsed === 'boolean' ? value.collapsed : DEFAULT_SESSION_SIDEBAR.collapsed,
    width: typeof value.width === 'number' && Number.isFinite(value.width) ? value.width : DEFAULT_SESSION_SIDEBAR.width,
  }
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * The Session the file holds, or null when there is none to restore: a
 * missing file, something that is not a Session, or an unknown `version`
 * (which the shell then rewrites in the current schema).
 */
export function parseSession(raw: unknown): Session | null {
  if (!isRecord(raw) || raw.version !== SESSION_VERSION) return null
  return {
    version: SESSION_VERSION,
    folder: parseNullableString(raw.folder),
    openEditors: parseEditors(raw.openEditors),
    activePath: parseNullableString(raw.activePath),
    theme: normalizeThemeMode(raw.theme) ?? DEFAULT_THEME_MODE,
    sidebar: parseSidebar(raw.sidebar),
  }
}

/**
 * The next surviving entry after `index` in `paths`, else the nearest
 * surviving one before it. Mirrors the successor rule for closing a Tab.
 */
function nearestSurvivor(paths: string[], index: number, survives: ReadonlySet<string>): string | null {
  const after = paths.slice(index + 1).find((path) => survives.has(path))
  if (after) return after
  const before = paths.slice(0, index).reverse().find((path) => survives.has(path))
  return before ?? null
}

/**
 * Restore rule (spec section 5): a Tab whose file no longer exists is dropped
 * silently; if it was the active one, the next surviving Tab in order becomes
 * active.
 */
export function restoreOpenEditors(
  session: Pick<Session, 'openEditors' | 'activePath'>,
  survives: ReadonlySet<string>,
): RestoredOpenEditors {
  const openEditors = session.openEditors.filter((editor) => survives.has(editor.path))
  if (openEditors.length === 0) return { openEditors, activePath: null }

  const paths = session.openEditors.map((editor) => editor.path)
  const activeIndex = session.activePath === null ? -1 : paths.indexOf(session.activePath)
  if (activeIndex === -1) return { openEditors, activePath: openEditors[0].path }
  if (survives.has(paths[activeIndex])) return { openEditors, activePath: paths[activeIndex] }
  return { openEditors, activePath: nearestSurvivor(paths, activeIndex, survives) }
}

/**
 * The Session for the open Tabs (every Document in Rich mode until AIM-381
 * remembers a mode per Tab) and the chosen appearance. An Image file entry
 * carries no `mode`: its kind comes from the extension.
 */
export function sessionForOpenEditors(
  openPaths: readonly string[],
  activePath: string | null,
  theme: ThemeMode,
  folder: string | null = null,
): Session {
  return {
    version: SESSION_VERSION,
    folder,
    openEditors: openPaths.map((path) => (isImageFilePath(path) ? { path } : { path, mode: 'rich' })),
    activePath,
    theme,
    sidebar: DEFAULT_SESSION_SIDEBAR,
  }
}
