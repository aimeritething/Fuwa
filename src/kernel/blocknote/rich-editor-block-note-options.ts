import { createRichEditorLinkExtension, RICH_EDITOR_REPLACED_LINK_EXTENSION } from './rich-editor-link-extension'

export const RICH_EDITOR_DISABLED_BLOCKNOTE_EXTENSIONS = ['previousBlockType'] as const

type RichEditorBlockNotePerformanceOptions = {
  animations: false
  disableExtensions: string[]
}

export const RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS = {
  animations: false,
  disableExtensions: [...RICH_EDITOR_DISABLED_BLOCKNOTE_EXTENSIONS],
} satisfies RichEditorBlockNotePerformanceOptions

/**
 * What every Rich editor is created with: the performance options, and Plumo's
 * link mark in place of BlockNote's (a `disableExtensions` name also drops one
 * of BlockNote's own tiptap extensions).
 */
export const RICH_EDITOR_BLOCKNOTE_OPTIONS = {
  ...RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS,
  disableExtensions: [...RICH_EDITOR_DISABLED_BLOCKNOTE_EXTENSIONS, RICH_EDITOR_REPLACED_LINK_EXTENSION],
  _tiptapOptions: { extensions: [createRichEditorLinkExtension()] },
}
