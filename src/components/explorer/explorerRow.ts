import { FileText, Folder, Image } from '@phosphor-icons/react'
import type { ExplorerRowKind } from '../../utils/explorerNames'

/** How an Explorer row is drawn: its icon, and where its parts sit. */

export const EXPLORER_ROW_ICONS: Record<ExplorerRowKind, typeof FileText> = {
  note: FileText,
  image: Image,
  folder: Folder,
}

/** 14px per level, from the row's own 8px inset (spec section 2). */
export function explorerRowIndent(depth: number): number {
  return 8 + depth * 14
}

/** Where a row's name starts: past the disclosure chevron and the icon, both with their gap. */
export function explorerNameIndent(depth: number): number {
  return explorerRowIndent(depth) + 38
}
