import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core'

// The formatting toolbar's reads of the selection. BlockNote can briefly
// expose an invalid selection while inline actions remount blocks, so every
// read here catches and falls back rather than throwing into a render.

export type FormattingToolbarEditor = BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>

export type SelectedBlock = ReturnType<FormattingToolbarEditor['getTextCursorPosition']>['block']

const FILE_BLOCK_TYPES = new Set(['audio', 'file', 'image', 'video'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isSelectedBlock(value: unknown): value is SelectedBlock {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.type === 'string'
    && isRecord(value.props)
}

function selectedBlocksOf(value: unknown): SelectedBlock[] {
  return Array.isArray(value) ? value.filter(isSelectedBlock) : []
}

export function isFileBlockType(type: string): boolean {
  return FILE_BLOCK_TYPES.has(type)
}

export function getSelectedBlocksSafely(editor: FormattingToolbarEditor): SelectedBlock[] {
  try {
    const selectionBlocks = selectedBlocksOf(editor.getSelection()?.blocks)
    if (selectionBlocks.length) return selectionBlocks
  } catch {
    // BlockNote can briefly expose an invalid selection while inline actions remount blocks.
  }

  try {
    const block = editor.getTextCursorPosition().block
    return isSelectedBlock(block) ? [block] : []
  } catch {
    return []
  }
}

export function getCursorBlockSafely(editor: FormattingToolbarEditor): SelectedBlock | null {
  try {
    const block = editor.getTextCursorPosition().block
    return isSelectedBlock(block) ? block : null
  } catch {
    return null
  }
}
