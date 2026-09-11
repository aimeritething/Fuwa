import { useCallback, useMemo, useState } from 'react'
import type { ExplorerNode } from '../utils/explorer'
import {
  creationParentPath,
  lockedExtension,
  nameCommitError,
  nextAvailableName,
  siblingNames,
  type ExplorerRowKind,
} from '../utils/explorerNames'
import {
  copyPathToClipboard,
  createDocumentFile,
  createFolderDirectory,
  renameFile,
  renameFolderDirectory,
  revealPath,
} from '../utils/explorerCommands'
import { notePathFilename } from '../utils/notePathIdentity'
import { isPathInsideVaultRoot } from '../utils/vaultPathContainment'
import { isWithinPrefix, replaceFolderPrefix } from './folder-actions/folderActionUtils'

/**
 * The Explorer's write operations and the state behind them (spec section 4,
 * AIM-387): the selected row, the row in inline rename, and the inline error.
 *
 * Creation writes to disk before anything is named: `Untitled.md` lands, its
 * Tab opens, and the new row enters rename with the stem selected. Rename is a
 * single `fs::rename` on the Rust side, with the name checked here first so
 * the reason shows under the row rather than as a thrown string.
 */

export interface ExplorerEditing {
  path: string
  kind: ExplorerRowKind
  /** The stem the row arrived with; a commit that matches it cancels silently. */
  stem: string
  /** Dim static text beside the input, never editable. */
  extension: string
}

export interface ExplorerActions {
  selected: string | null
  select: (path: string) => void
  editing: ExplorerEditing | null
  error: string | null
  /** ⌘N and the header "+": a Document where the selection points. */
  createDocument: () => void
  /** The header "…" and a folder's menu: a folder where the selection points. */
  createFolder: () => void
  createDocumentIn: (folderPath: string) => void
  createFolderIn: (folderPath: string) => void
  startRename: (path: string, kind: ExplorerRowKind) => void
  commitRename: (stem: string) => Promise<boolean>
  cancelRename: () => void
  reveal: (path: string) => void
  copyPath: (path: string) => void
}

interface Options {
  folder: string | null
  /** The Explorer tree, or null with no Folder open. */
  tree: ExplorerNode | null
  activeTabPath: string | null
  refresh: () => Promise<void>
  openNote: (path: string) => void
  /**
   * Write the active Document's pending edits before a rename moves it, so the
   * save buffer is not left holding bytes for a path that no longer exists. A
   * refusal is the error bar's to report, and does not stop the rename.
   */
  settleActiveDocument: () => Promise<void>
  /** Move an open Tab, and every Tab under a renamed folder, to the new path. */
  retargetTabs: (oldPath: string, newPath: string) => void
}

/** How many suffixes to try before giving up; creation never errors, so it gives up quietly. */
const CREATE_ATTEMPTS = 25

function failureMessage(cause: unknown): string {
  if (typeof cause === 'string') return cause
  if (cause instanceof Error) return cause.message
  return 'That name could not be used'
}

/**
 * Take the first name the filesystem accepts. The listing says which names are
 * taken, but it can be a moment stale, so a refused write suffixes and tries
 * again rather than reporting anything: creation never errors.
 */
async function createWithFreeName(
  taken: readonly string[],
  base: string,
  extension: string,
  write: (name: string) => Promise<unknown>,
): Promise<string | null> {
  const held = [...taken]
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    const name = nextAvailableName(held, base, extension)
    try {
      await write(name)
      return name
    } catch {
      held.push(name)
    }
  }
  return null
}

/** The selected row follows the active Tab, and drops when that Tab is outside the Folder. */
function useSelectionFollowingActiveTab(activeTabPath: string | null, folder: string | null) {
  const [selected, setSelected] = useState<string | null>(null)
  const [followed, setFollowed] = useState<string | null>(null)
  if (followed !== activeTabPath) {
    setFollowed(activeTabPath)
    setSelected(activeTabPath && folder && isPathInsideVaultRoot(activeTabPath, folder) ? activeTabPath : null)
  }

  /**
   * A rename moved the row, and with it the active Tab. The Tab it follows is
   * carried across by hand so the next render sees no change and leaves the
   * selection alone: renaming a folder keeps the *folder* row selected, not
   * the Document that happens to be open beneath it.
   */
  const selectThroughRename = useCallback((oldPath: string, newPath: string) => {
    setFollowed((current) => (
      current && isWithinPrefix({ path: current, prefix: oldPath })
        ? replaceFolderPrefix({ path: current, oldPrefix: oldPath, newPrefix: newPath })
        : current
    ))
    setSelected(newPath)
  }, [])

  return { selected, setSelected, selectThroughRename }
}

export function useExplorerActions(options: Options): ExplorerActions {
  const { folder, tree, activeTabPath, refresh, openNote, settleActiveDocument, retargetTabs } = options
  const { selected, setSelected, selectThroughRename } = useSelectionFollowingActiveTab(activeTabPath, folder)
  const [editing, setEditing] = useState<ExplorerEditing | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startRename = useCallback((path: string, kind: ExplorerRowKind) => {
    const { stem, extension } = kind === 'folder'
      ? { stem: notePathFilename(path), extension: '' }
      : lockedExtension(notePathFilename(path))
    setSelected(path)
    setError(null)
    setEditing({ path, kind, stem, extension })
  }, [setSelected])

  const cancelRename = useCallback(() => {
    setEditing(null)
    setError(null)
  }, [])

  const createDocumentIn = useCallback((folderPath: string) => {
    void (async () => {
      if (!folder || !tree) return
      const name = await createWithFreeName(
        siblingNames(tree, folderPath, { of: 'children' }),
        'Untitled',
        '.md',
        (candidate) => createDocumentFile({ folder, path: `${folderPath}/${candidate}` }),
      )
      if (!name) return
      const path = `${folderPath}/${name}`
      await refresh()
      openNote(path)
      startRename(path, 'note')
    })().catch((cause: unknown) => console.warn('Could not create a Document:', cause))
  }, [folder, openNote, refresh, startRename, tree])

  const createFolderIn = useCallback((folderPath: string) => {
    void (async () => {
      if (!folder || !tree) return
      const name = await createWithFreeName(
        siblingNames(tree, folderPath, { of: 'children' }),
        'New Folder',
        '',
        (candidate) => createFolderDirectory({ folder, parentPath: folderPath, name: candidate }),
      )
      if (!name) return
      await refresh()
      startRename(`${folderPath}/${name}`, 'folder')
    })().catch((cause: unknown) => console.warn('Could not create a folder:', cause))
  }, [folder, refresh, startRename, tree])

  // One placement rule for ⌘N, the header "+" and the context menu: a folder
  // or the root row takes it inside, a file row takes it into its parent, and
  // nothing selected means the Folder root.
  const createDocument = useCallback(() => {
    if (tree) createDocumentIn(creationParentPath(tree, selected))
  }, [createDocumentIn, selected, tree])

  const createFolder = useCallback(() => {
    if (tree) createFolderIn(creationParentPath(tree, selected))
  }, [createFolderIn, selected, tree])

  const commitRename = useCallback(async (typed: string): Promise<boolean> => {
    if (!editing || !folder || !tree) return true
    const stem = typed.trim()
    // Blur commits a changed name; unchanged or empty cancels without a word.
    if (!stem || stem === editing.stem) {
      cancelRename()
      return true
    }

    // The typed value, untrimmed: a trailing space is one of the things the
    // spec reports, and the Rust side would quietly trim it away.
    const refusal = nameCommitError({
      kind: editing.kind,
      stem: typed,
      extension: editing.extension,
      siblings: siblingNames(tree, editing.path),
    })
    if (refusal) {
      setError(refusal)
      return false
    }

    await settleActiveDocument().catch(() => {})
    try {
      const path = editing.kind === 'folder'
        ? await renameFolderDirectory({ folder, path: editing.path, name: stem })
        : await renameFile({ folder, path: editing.path, stem })
      retargetTabs(editing.path, path)
      selectThroughRename(editing.path, path)
      setEditing(null)
      setError(null)
      await refresh()
      return true
    } catch (cause: unknown) {
      setError(failureMessage(cause))
      return false
    }
  }, [cancelRename, editing, folder, refresh, retargetTabs, selectThroughRename, settleActiveDocument, tree])

  const reveal = useCallback((path: string) => {
    revealPath(path).catch((cause: unknown) => console.warn('Could not reveal the path:', cause))
  }, [])

  const copyPath = useCallback((path: string) => {
    copyPathToClipboard(path).catch((cause: unknown) => console.warn('Could not copy the path:', cause))
  }, [])

  return useMemo(() => ({
    selected,
    select: setSelected,
    editing,
    error,
    createDocument,
    createFolder,
    createDocumentIn,
    createFolderIn,
    startRename,
    commitRename,
    cancelRename,
    reveal,
    copyPath,
  }), [
    cancelRename, commitRename, copyPath, createDocument, createDocumentIn, createFolder,
    createFolderIn, editing, error, reveal, selected, setSelected, startRename,
  ])
}
