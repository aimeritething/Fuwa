import type { useCreateBlockNote } from '@blocknote/react'

const HIGHLIGHT_PLUGIN_KEY_PREFIX = 'prosemirror-highlight$'
const HIGHLIGHT_REFRESH_META = 'prosemirror-highlight-refresh'

type HighlightRefreshTransaction = {
  setMeta: (key: string, value: boolean) => HighlightRefreshTransaction
}

type HighlightRefreshView = {
  dispatch: (transaction: HighlightRefreshTransaction) => void
  state: {
    config?: {
      pluginsByKey?: Record<string, unknown>
    }
    tr: HighlightRefreshTransaction
  }
}

type EditorWithHighlightRefreshView = {
  _tiptapEditor?: {
    view?: HighlightRefreshView | null
  } | null
  prosemirrorView?: HighlightRefreshView | null
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function clearHighlightCache(view: HighlightRefreshView) {
  const pluginKey = Object.keys(view.state.config?.pluginsByKey ?? {}).find((key) =>
    key.startsWith(HIGHLIGHT_PLUGIN_KEY_PREFIX),
  )
  if (!pluginKey) return

  const pluginState = recordValue(Reflect.get(view.state, pluginKey))
  const decorationCache = recordValue(pluginState?.cache)
  const cacheMap = decorationCache?.cache
  if (cacheMap instanceof Map) cacheMap.clear()
}

function highlightRefreshView(editor: ReturnType<typeof useCreateBlockNote>) {
  const editorWithView = editor as unknown as EditorWithHighlightRefreshView
  return editorWithView._tiptapEditor?.view ?? editorWithView.prosemirrorView ?? null
}

export function refreshCodeBlockSyntaxHighlighting(editor: ReturnType<typeof useCreateBlockNote>) {
  const view = highlightRefreshView(editor)
  if (!view) return

  clearHighlightCache(view)
  const transaction = view.state.tr.setMeta(HIGHLIGHT_REFRESH_META, true)

  view.dispatch(transaction)
}
