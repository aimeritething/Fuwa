/**
 * What the Explorer's context menu holds, per row kind. The
 * table is data so the menu component stays a renderer and the order is
 * checked by a test rather than by eye.
 *
 * Pin, Reveal in Finder and Copy Path here act on the row the menu was
 * opened on. The manifest commands of the same names (File and Edit menus,
 * the Command Menu) act on the active Tab instead. Pin reads Unpin on a row
 * that is already pinned; a folder has neither (CONTEXT.md, Pinned).
 */

export type ExplorerMenuAction =
  | 'pin'
  | 'newDocument'
  | 'newFolder'
  | 'rename'
  | 'trash'
  | 'reveal'
  | 'copyPath'

/** A row the menu can act on, plus the empty area below the tree. */
export type ExplorerMenuTargetKind = 'note' | 'image' | 'folder' | 'root' | 'empty'

export type ExplorerMenuEntry =
  | { kind: 'item'; action: ExplorerMenuAction }
  | { kind: 'separator' }

export const EXPLORER_MENU_LABELS: Record<ExplorerMenuAction, string> = {
  pin: 'Pin',
  newDocument: 'New Document',
  newFolder: 'New Folder',
  rename: 'Rename…',
  trash: 'Move to Trash',
  reveal: 'Reveal in Finder',
  copyPath: 'Copy Path',
}

/** Pin's label on a row that is pinned already. */
export const EXPLORER_UNPIN_LABEL = 'Unpin'

const SEPARATOR: ExplorerMenuEntry = { kind: 'separator' }

function items(...actions: ExplorerMenuAction[]): ExplorerMenuEntry[] {
  return actions.map((action) => ({ kind: 'item', action }))
}

const CREATION = items('newDocument', 'newFolder')
const HAND_OFFS = items('reveal', 'copyPath')
const OWN_FILE = items('rename', 'trash')
const PIN = items('pin')

const MENUS: Record<ExplorerMenuTargetKind, ExplorerMenuEntry[]> = {
  note: [...PIN, SEPARATOR, ...OWN_FILE, SEPARATOR, ...HAND_OFFS],
  image: [...PIN, SEPARATOR, ...OWN_FILE, SEPARATOR, ...HAND_OFFS],
  folder: [...CREATION, SEPARATOR, ...OWN_FILE, SEPARATOR, ...HAND_OFFS],
  root: [...CREATION, SEPARATOR, ...HAND_OFFS],
  empty: CREATION,
}

export function explorerMenuEntries(target: ExplorerMenuTargetKind): readonly ExplorerMenuEntry[] {
  return MENUS[target]
}
