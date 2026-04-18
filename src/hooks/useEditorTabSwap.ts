import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import type { VaultEntry } from '../types'
import { splitFrontmatter, preProcessWikilinks, injectWikilinks, restoreWikilinksInBlocks } from '../utils/wikilinks'
import { compactMarkdown } from '../utils/compact-markdown'

interface Tab {
  entry: VaultEntry
  content: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote block arrays
type EditorBlocks = any[]
type CachedTabState = { blocks: EditorBlocks; scrollTop: number }

interface UseEditorTabSwapOptions {
  tabs: Tab[]
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  onContentChange?: (path: string, content: string) => void
  /** When true, the BlockNote editor is hidden (raw/CodeMirror mode active). */
  rawMode?: boolean
}

function signalEditorTabSwapped(path: string): void {
  window.dispatchEvent(new CustomEvent('laputa:editor-tab-swapped', {
    detail: { path },
  }))
}

/** Strip the YAML frontmatter from raw file content, returning the body
 *  (including any H1 heading) that should appear in the editor. */
export function extractEditorBody(rawFileContent: string): string {
  const [, rawBody] = splitFrontmatter(rawFileContent)
  return rawBody.trimStart()
}

type HeadingTextInline = { type?: string; text?: string }

function extractH1Content(blocks: unknown[]): HeadingTextInline[] | null {
  const first = blocks?.[0] as {
    type?: string
    props?: { level?: number }
    content?: HeadingTextInline[]
  } | undefined

  if (!first) return null
  if (first.type !== 'heading') return null
  if (first.props?.level !== 1) return null
  if (!Array.isArray(first.content)) return null
  return first.content
}

/** Extract H1 text from the editor's first block, or null if not an H1. */
export function getH1TextFromBlocks(blocks: unknown[]): string | null {
  const content = extractH1Content(blocks)
  if (!content) return null

  let text = ''
  for (const item of content) {
    if (item.type === 'text') {
      text += item.text || ''
    }
  }

  const trimmed = text.trim()
  return trimmed || null
}

/** Replace the title: line in YAML frontmatter with a new title value. */
export function replaceTitleInFrontmatter(frontmatter: string, newTitle: string): string {
  return frontmatter.replace(/^(title:\s*).+$/m, `$1${newTitle}`)
}

function pathStem(path: string): string {
  const filename = path.split('/').pop() ?? path
  return filename.replace(/\.md$/, '')
}

function slugifyPathStem(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function isUntitledPath(path: string): boolean {
  return pathStem(path).startsWith('untitled-')
}

function readEditorScrollTop(): number {
  const scrollEl = document.querySelector('.editor__blocknote-container')
  return scrollEl?.scrollTop ?? 0
}

function cacheEditorState(
  cache: Map<string, CachedTabState>,
  path: string,
  blocks: EditorBlocks,
) {
  cache.set(path, {
    blocks,
    scrollTop: readEditorScrollTop(),
  })
}

function buildFastPathBlocks(preprocessed: string): EditorBlocks | null {
  const trimmed = preprocessed.trim()

  if (!trimmed) {
    return [{ type: 'paragraph', content: [] }]
  }

  if (trimmed === '#') {
    return [
      { type: 'heading', props: { level: 1, textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [], children: [] },
      { type: 'paragraph', content: [], children: [] },
    ]
  }

  const h1OnlyMatch = trimmed.match(/^# (.+)$/)
  if (!h1OnlyMatch) return null

  return [
    { type: 'heading', props: { level: 1, textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [{ type: 'text', text: h1OnlyMatch[1], styles: {} }], children: [] },
    { type: 'paragraph', content: [], children: [] },
  ]
}

function isBlankBodyContent(content: string): boolean {
  return extractEditorBody(content).trim() === ''
}

function extractBodyRemainderAfterEmptyH1(content: string): string | null {
  const body = extractEditorBody(content)
  const [firstLine, secondLine, ...rest] = body.split('\n')
  if (!firstLine) return null

  const normalizedFirstLine = firstLine.trimEnd()
  if (normalizedFirstLine !== '#' && normalizedFirstLine !== '# ') return null

  if (secondLine === '') {
    return rest.join('\n').trimStart()
  }

  return [secondLine, ...rest].join('\n').trimStart()
}

function blankParagraphBlocks(): EditorBlocks {
  return [{ type: 'paragraph', content: [], children: [] }]
}

async function parseMarkdownBlocks(
  editor: ReturnType<typeof useCreateBlockNote>,
  preprocessed: string,
): Promise<EditorBlocks> {
  const result = editor.tryParseMarkdownToBlocks(preprocessed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tryParseMarkdownToBlocks returns sync or async BlockNote blocks
  if (result && typeof (result as any).then === 'function') {
    return (result as unknown as Promise<EditorBlocks>)
  }
  return result as EditorBlocks
}

async function resolveBlocksForTarget(
  editor: ReturnType<typeof useCreateBlockNote>,
  cache: Map<string, CachedTabState>,
  targetPath: string,
  content: string,
): Promise<CachedTabState> {
  const cached = cache.get(targetPath)
  if (cached) return cached

  const body = extractEditorBody(content)
  const preprocessed = preProcessWikilinks(body)
  const fastPathBlocks = buildFastPathBlocks(preprocessed)
  if (fastPathBlocks) {
    const nextState = { blocks: fastPathBlocks, scrollTop: 0 }
    cache.set(targetPath, nextState)
    return nextState
  }

  const parsed = await parseMarkdownBlocks(editor, preprocessed)
  const withWikilinks = injectWikilinks(parsed)
  if (withWikilinks.length > 0) {
    cache.set(targetPath, { blocks: withWikilinks, scrollTop: 0 })
  }
  return { blocks: withWikilinks, scrollTop: 0 }
}

function applyBlocksToEditor(
  editor: ReturnType<typeof useCreateBlockNote>,
  blocks: EditorBlocks,
  scrollTop: number,
  suppressChangeRef: MutableRefObject<boolean>,
) {
  suppressChangeRef.current = true
  try {
    const current = editor.document
    if (current.length > 0 && blocks.length > 0) {
      editor.replaceBlocks(current, blocks)
    } else if (blocks.length > 0) {
      editor.insertBlocks(blocks, current[0], 'before')
    }
  } catch (err) {
    console.error('applyBlocks failed, trying fallback:', err)
    try {
      const html = editor.blocksToHTMLLossy(blocks)
      editor._tiptapEditor.commands.setContent(html)
    } catch (err2) {
      console.error('Fallback also failed:', err2)
    }
  } finally {
    queueMicrotask(() => { suppressChangeRef.current = false })
  }

  requestAnimationFrame(() => {
    const scrollEl = document.querySelector('.editor__blocknote-container')
    if (scrollEl) scrollEl.scrollTop = scrollTop
  })
}

function applyBlankStateToEditor(
  editor: ReturnType<typeof useCreateBlockNote>,
  suppressChangeRef: MutableRefObject<boolean>,
) {
  suppressChangeRef.current = true
  try {
    editor._tiptapEditor.commands.setContent('<p></p>')
  } catch (err) {
    console.error('applyBlankStateToEditor failed, falling back to replaceBlocks:', err)
    applyBlocksToEditor(editor, blankParagraphBlocks(), 0, suppressChangeRef)
    return
  }

  queueMicrotask(() => { suppressChangeRef.current = false })
  requestAnimationFrame(() => {
    const scrollEl = document.querySelector('.editor__blocknote-container')
    if (scrollEl) scrollEl.scrollTop = 0
  })
}

function applyHtmlStateToEditor(
  editor: ReturnType<typeof useCreateBlockNote>,
  html: string,
  suppressChangeRef: MutableRefObject<boolean>,
) {
  suppressChangeRef.current = true
  try {
    editor._tiptapEditor.commands.setContent(html)
  } catch (err) {
    console.error('applyHtmlStateToEditor failed:', err)
    suppressChangeRef.current = false
    throw err
  }

  queueMicrotask(() => { suppressChangeRef.current = false })
  requestAnimationFrame(() => {
    const scrollEl = document.querySelector('.editor__blocknote-container')
    if (scrollEl) scrollEl.scrollTop = 0
  })
}

async function resolveEmptyHeadingHtml(
  editor: ReturnType<typeof useCreateBlockNote>,
  content: string,
): Promise<string | null> {
  const remainder = extractBodyRemainderAfterEmptyH1(content)
  if (remainder === null) return null
  if (!remainder.trim()) return '<h1></h1><p></p>'

  const parsed = await parseMarkdownBlocks(editor, preProcessWikilinks(remainder))
  const withWikilinks = injectWikilinks(parsed)
  return `<h1></h1>${editor.blocksToHTMLLossy(withWikilinks as typeof parsed)}`
}

function findActiveTab(tabs: Tab[], activeTabPath: string | null): Tab | undefined {
  return activeTabPath
    ? tabs.find(tab => tab.entry.path === activeTabPath)
    : undefined
}

function serializeEditorBody(editor: ReturnType<typeof useCreateBlockNote>): string {
  const restored = restoreWikilinksInBlocks(editor.document)
  return compactMarkdown(editor.blocksToMarkdownLossy(restored as typeof editor.document))
}

function normalizeTabBody(content: string): string {
  return compactMarkdown(extractEditorBody(content))
}

function renameBodiesOverlap(currentBody: string, nextBody: string): boolean {
  const current = currentBody.trimEnd()
  const next = nextBody.trimEnd()
  return current === next
    || current.startsWith(next)
    || next.startsWith(current)
}

function isUntitledRenameTransition(
  prevPath: string | null,
  nextPath: string | null,
  activeTab: Tab | undefined,
  editor: ReturnType<typeof useCreateBlockNote>,
): boolean {
  if (!prevPath || !nextPath || !activeTab || !isUntitledPath(prevPath)) return false

  const currentHeading = getH1TextFromBlocks(editor.document)
  if (!currentHeading || slugifyPathStem(currentHeading) !== pathStem(nextPath)) return false

  return renameBodiesOverlap(
    serializeEditorBody(editor),
    normalizeTabBody(activeTab.content),
  )
}

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function useEditorMountState(
  editor: ReturnType<typeof useCreateBlockNote>,
  editorMountedRef: MutableRefObject<boolean>,
  pendingSwapRef: MutableRefObject<(() => void) | null>,
) {
  useEffect(() => {
    if (editor.prosemirrorView) {
      editorMountedRef.current = true
    }
    const cleanup = editor.onMount(() => {
      editorMountedRef.current = true
      if (pendingSwapRef.current) {
        const swap = pendingSwapRef.current
        pendingSwapRef.current = null
        queueMicrotask(swap)
      }
    })
    return cleanup
  }, [editor, editorMountedRef, pendingSwapRef])
}

function useEditorChangeHandler(options: {
  editor: ReturnType<typeof useCreateBlockNote>
  tabsRef: MutableRefObject<Tab[]>
  onContentChangeRef: MutableRefObject<((path: string, content: string) => void) | undefined>
  prevActivePathRef: MutableRefObject<string | null>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    editor,
    tabsRef,
    onContentChangeRef,
    prevActivePathRef,
    suppressChangeRef,
  } = options

  return useCallback(() => {
    if (suppressChangeRef.current) return
    const path = prevActivePathRef.current
    if (!path) return

    const tab = tabsRef.current.find(t => t.entry.path === path)
    if (!tab) return

    const blocks = editor.document
    const restored = restoreWikilinksInBlocks(blocks)
    const bodyMarkdown = compactMarkdown(editor.blocksToMarkdownLossy(restored as typeof blocks))
    const [frontmatter] = splitFrontmatter(tab.content)
    onContentChangeRef.current?.(path, `${frontmatter}${bodyMarkdown}`)
  }, [editor, onContentChangeRef, prevActivePathRef, suppressChangeRef, tabsRef])
}

function consumeRawModeTransition(
  prevRawModeRef: MutableRefObject<boolean>,
  rawMode: boolean | undefined,
) {
  const rawModeJustEnded = prevRawModeRef.current && !rawMode
  prevRawModeRef.current = !!rawMode
  return rawModeJustEnded
}

function cachePreviousTabOnPathChange(options: {
  prevPath: string | null
  pathChanged: boolean
  editorMountedRef: MutableRefObject<boolean>
  cache: Map<string, CachedTabState>
  editor: ReturnType<typeof useCreateBlockNote>
}) {
  const { prevPath, pathChanged, editorMountedRef, cache, editor } = options
  if (!prevPath || !pathChanged || !editorMountedRef.current) return
  cacheEditorState(cache, prevPath, editor.document)
}

function shouldWaitForActiveTab(
  pathChanged: boolean,
  activeTabPath: string | null,
  activeTab: Tab | undefined,
) {
  return pathChanged && !!activeTabPath && !activeTab
}

function syncActivePathTransition(options: {
  prevPath: string | null
  pathChanged: boolean
  activeTabPath: string | null
  activeTab: Tab | undefined
  cache: Map<string, CachedTabState>
  editor: ReturnType<typeof useCreateBlockNote>
  editorMountedRef: MutableRefObject<boolean>
  prevActivePathRef: MutableRefObject<string | null>
}) {
  const {
    prevPath,
    pathChanged,
    activeTabPath,
    activeTab,
    cache,
    editor,
    editorMountedRef,
    prevActivePathRef,
  } = options

  cachePreviousTabOnPathChange({ prevPath, pathChanged, editorMountedRef, cache, editor })
  if (shouldWaitForActiveTab(pathChanged, activeTabPath, activeTab)) return true

  if (!preserveUntitledRenameState({
    prevPath,
    activeTabPath,
    activeTab,
    cache,
    editor,
    editorMountedRef,
  })) {
    prevActivePathRef.current = activeTabPath
    return false
  }

  prevActivePathRef.current = activeTabPath
  return true
}

function handleStableActivePath(options: {
  pathChanged: boolean
  rawModeJustEnded: boolean
  activeTabPath: string | null
  activeTab: Tab | undefined
  cache: Map<string, CachedTabState>
  editor: ReturnType<typeof useCreateBlockNote>
  editorMountedRef: MutableRefObject<boolean>
  rawSwapPendingRef: MutableRefObject<boolean>
}) {
  const {
    pathChanged,
    rawModeJustEnded,
    activeTabPath,
    activeTab,
    cache,
    editor,
    editorMountedRef,
    rawSwapPendingRef,
  } = options

  if (pathChanged) return false
  if (rawModeJustEnded && activeTabPath) {
    cache.delete(activeTabPath)
    rawSwapPendingRef.current = true
    return false
  }
  if (rawSwapPendingRef.current) return true

  cacheStableActivePath({
    cache,
    activeTabPath,
    activeTab,
    editor,
    editorMountedRef,
  })
  return true
}

function cacheStableActivePath(options: {
  cache: Map<string, CachedTabState>
  activeTabPath: string | null
  activeTab: Tab | undefined
  editor: ReturnType<typeof useCreateBlockNote>
  editorMountedRef: MutableRefObject<boolean>
}) {
  const {
    cache,
    activeTabPath,
    activeTab,
    editor,
    editorMountedRef,
  } = options

  if (!activeTabPath || !activeTab || !editorMountedRef.current) return
  cacheEditorState(cache, activeTabPath, editor.document)
}

function preserveUntitledRenameState(options: {
  prevPath: string | null
  activeTabPath: string | null
  activeTab: Tab | undefined
  cache: Map<string, CachedTabState>
  editor: ReturnType<typeof useCreateBlockNote>
  editorMountedRef: MutableRefObject<boolean>
}) {
  const {
    prevPath,
    activeTabPath,
    activeTab,
    cache,
    editor,
    editorMountedRef,
  } = options

  if (!prevPath || !activeTabPath) return false
  if (!isUntitledRenameTransition(prevPath, activeTabPath, activeTab, editor)) return false

  cache.delete(prevPath)
  cacheStableActivePath({
    cache,
    activeTabPath,
    activeTab,
    editor,
    editorMountedRef,
  })
  requestAnimationFrame(() => signalEditorTabSwapped(activeTabPath))
  return true
}

function signalTabSwap(path: string) {
  requestAnimationFrame(() => signalEditorTabSwapped(path))
}

function clearStaleSwap(
  targetPath: string,
  prevActivePathRef: MutableRefObject<string | null>,
  suppressChangeRef: MutableRefObject<boolean>,
): boolean {
  if (prevActivePathRef.current === targetPath) return false
  suppressChangeRef.current = false
  return true
}

function applyBlankTabState(options: {
  cache: Map<string, CachedTabState>
  targetPath: string
  editor: ReturnType<typeof useCreateBlockNote>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    cache,
    targetPath,
    editor,
    suppressChangeRef,
  } = options

  cache.set(targetPath, { blocks: blankParagraphBlocks(), scrollTop: 0 })
  applyBlankStateToEditor(editor, suppressChangeRef)
  signalTabSwap(targetPath)
}

function scheduleEmptyHeadingSwap(options: {
  editor: ReturnType<typeof useCreateBlockNote>
  targetPath: string
  content: string
  prevActivePathRef: MutableRefObject<string | null>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    editor,
    targetPath,
    content,
    prevActivePathRef,
    suppressChangeRef,
  } = options

  if (extractBodyRemainderAfterEmptyH1(content) === null) return false

  void resolveEmptyHeadingHtml(editor, content)
    .then((html) => {
      if (prevActivePathRef.current !== targetPath || !html) return
      applyHtmlStateToEditor(editor, html, suppressChangeRef)
      signalTabSwap(targetPath)
    })
    .catch((err: unknown) => {
      suppressChangeRef.current = false
      console.error('Failed to render empty heading state:', err)
    })

  return true
}

function scheduleParsedBlockSwap(options: {
  editor: ReturnType<typeof useCreateBlockNote>
  cache: Map<string, CachedTabState>
  targetPath: string
  content: string
  prevActivePathRef: MutableRefObject<string | null>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    editor,
    cache,
    targetPath,
    content,
    prevActivePathRef,
    suppressChangeRef,
  } = options

  void resolveBlocksForTarget(editor, cache, targetPath, content)
    .then(({ blocks, scrollTop }) => {
      if (prevActivePathRef.current !== targetPath) return
      applyBlocksToEditor(editor, blocks, scrollTop, suppressChangeRef)
      signalTabSwap(targetPath)
    })
    .catch((err: unknown) => {
      suppressChangeRef.current = false
      console.error('Failed to parse/swap editor content:', err)
    })
}

function scheduleTabSwap(options: {
  editor: ReturnType<typeof useCreateBlockNote>
  cache: Map<string, CachedTabState>
  targetPath: string
  activeTab: Tab
  pendingSwapRef: MutableRefObject<(() => void) | null>
  prevActivePathRef: MutableRefObject<string | null>
  rawSwapPendingRef: MutableRefObject<boolean>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    editor,
    cache,
    targetPath,
    activeTab,
    pendingSwapRef,
    prevActivePathRef,
    rawSwapPendingRef,
    suppressChangeRef,
  } = options

  suppressChangeRef.current = true

  const doSwap = () => {
    if (clearStaleSwap(targetPath, prevActivePathRef, suppressChangeRef)) return
    rawSwapPendingRef.current = false

    if (isBlankBodyContent(activeTab.content)) {
      applyBlankTabState({ cache, targetPath, editor, suppressChangeRef })
      return
    }

    if (scheduleEmptyHeadingSwap({
      editor,
      targetPath,
      content: activeTab.content,
      prevActivePathRef,
      suppressChangeRef,
    })) {
      return
    }

    scheduleParsedBlockSwap({
      editor,
      cache,
      targetPath,
      content: activeTab.content,
      prevActivePathRef,
      suppressChangeRef,
    })
  }

  if (editor.prosemirrorView) {
    queueMicrotask(doSwap)
    return
  }
  pendingSwapRef.current = doSwap
}

function runTabSwapEffect(options: {
  tabs: Tab[]
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  rawMode?: boolean
  tabCacheRef: MutableRefObject<Map<string, CachedTabState>>
  prevActivePathRef: MutableRefObject<string | null>
  editorMountedRef: MutableRefObject<boolean>
  pendingSwapRef: MutableRefObject<(() => void) | null>
  prevRawModeRef: MutableRefObject<boolean>
  rawSwapPendingRef: MutableRefObject<boolean>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    tabs,
    activeTabPath,
    editor,
    rawMode,
    tabCacheRef,
    prevActivePathRef,
    editorMountedRef,
    pendingSwapRef,
    prevRawModeRef,
    rawSwapPendingRef,
    suppressChangeRef,
  } = options

  const cache = tabCacheRef.current
  const prevPath = prevActivePathRef.current
  const pathChanged = prevPath !== activeTabPath
  const activeTab = findActiveTab(tabs, activeTabPath)
  const rawModeJustEnded = consumeRawModeTransition(prevRawModeRef, rawMode)

  if (rawMode) return
  if (syncActivePathTransition({
    prevPath,
    pathChanged,
    activeTabPath,
    activeTab,
    cache,
    editor,
    editorMountedRef,
    prevActivePathRef,
  })) {
    return
  }

  if (handleStableActivePath({
    pathChanged,
    rawModeJustEnded,
    activeTabPath,
    activeTab,
    cache,
    editor,
    editorMountedRef,
    rawSwapPendingRef,
  })) {
    return
  }

  if (!activeTabPath || !activeTab) return

  scheduleTabSwap({
    editor,
    cache,
    targetPath: activeTabPath,
    activeTab,
    pendingSwapRef,
    prevActivePathRef,
    rawSwapPendingRef,
    suppressChangeRef,
  })
}

function useTabSwapEffect(options: {
  tabs: Tab[]
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  rawMode?: boolean
  tabCacheRef: MutableRefObject<Map<string, CachedTabState>>
  prevActivePathRef: MutableRefObject<string | null>
  editorMountedRef: MutableRefObject<boolean>
  pendingSwapRef: MutableRefObject<(() => void) | null>
  prevRawModeRef: MutableRefObject<boolean>
  rawSwapPendingRef: MutableRefObject<boolean>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    tabs,
    activeTabPath,
    editor,
    rawMode,
    tabCacheRef,
    prevActivePathRef,
    editorMountedRef,
    pendingSwapRef,
    prevRawModeRef,
    rawSwapPendingRef,
    suppressChangeRef,
  } = options

  useEffect(() => {
    runTabSwapEffect({
      tabs,
      activeTabPath,
      editor,
      rawMode,
      tabCacheRef,
      editorMountedRef,
      prevActivePathRef,
      pendingSwapRef,
      prevRawModeRef,
      rawSwapPendingRef,
      suppressChangeRef,
    })
  }, [
    activeTabPath,
    editor,
    editorMountedRef,
    pendingSwapRef,
    prevActivePathRef,
    prevRawModeRef,
    rawMode,
    rawSwapPendingRef,
    suppressChangeRef,
    tabCacheRef,
    tabs,
  ])
}

function useTabCacheCleanup(
  tabs: Tab[],
  tabCacheRef: MutableRefObject<Map<string, CachedTabState>>,
) {
  const tabPathsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const currentPaths = new Set(tabs.map(t => t.entry.path))
    for (const path of tabPathsRef.current) {
      if (!currentPaths.has(path)) {
        tabCacheRef.current.delete(path)
      }
    }
    tabPathsRef.current = currentPaths
  }, [tabs, tabCacheRef])
}

/**
 * Manages the tab content-swap machinery for the BlockNote editor.
 *
 * Owns all refs and effects related to:
 * - Tracking editor mount state (editorMountedRef, pendingSwapRef)
 * - Swapping document content when the active tab changes (with caching)
 * - Cleaning up the block cache when tabs are closed
 * - Serializing editor blocks → markdown on change (suppressChangeRef)
 *
 * Returns `handleEditorChange`, the onChange callback for SingleEditorView.
 */
export function useEditorTabSwap({ tabs, activeTabPath, editor, onContentChange, rawMode }: UseEditorTabSwapOptions) {
  const tabCacheRef = useRef<Map<string, CachedTabState>>(new Map())
  const prevActivePathRef = useRef<string | null>(null)
  const editorMountedRef = useRef(false)
  const pendingSwapRef = useRef<(() => void) | null>(null)
  const prevRawModeRef = useRef(!!rawMode)
  const rawSwapPendingRef = useRef(false)
  const suppressChangeRef = useRef(false)
  const onContentChangeRef = useLatestRef(onContentChange)
  const tabsRef = useLatestRef(tabs)
  const handleEditorChange = useEditorChangeHandler({
    editor,
    tabsRef,
    onContentChangeRef,
    prevActivePathRef,
    suppressChangeRef,
  })

  useEditorMountState(editor, editorMountedRef, pendingSwapRef)
  useTabSwapEffect({
    tabs,
    activeTabPath,
    editor,
    rawMode,
    tabCacheRef,
    prevActivePathRef,
    editorMountedRef,
    pendingSwapRef,
    prevRawModeRef,
    rawSwapPendingRef,
    suppressChangeRef,
  })
  useTabCacheCleanup(tabs, tabCacheRef)

  return { handleEditorChange, editorMountedRef }
}
