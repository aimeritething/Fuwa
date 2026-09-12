import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import 'katex/dist/katex.min.css'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { useEditorFocus } from '../hooks/useEditorFocus'
import { useEditorTheme } from '../hooks/useTheme'
import { useEditorFocusScope } from '../hooks/editorFocusOwnership'
import { RUNTIME_STYLE_NONCE } from '../lib/runtimeStyleNonce'
import type { EditorMode, Tab } from '../types'
import type { ListedFile } from '../utils/explorer'
import { documentRoot } from '../utils/explorer'
import { documentFrontmatter, frontmatterBadgeLabel } from '../utils/frontmatterStatus'
import { activeTabPaths, imageFetchVersion, imageMetadataLabel, type ImageNaturalSize } from '../utils/imageFile'
import { noteRootForPath } from '../utils/noteEntry'
import { notePathFilename } from '../utils/notePathIdentity'
import { dispatchEditorFindAvailability } from '../utils/editorFindEvents'
import { installRichEditorMarkdownSerializer } from '../utils/richEditorMarkdown'
import type { WriteFailure } from '../hooks/useWriteFailures'
import { useRegisterEditorContentFlushes } from './editorContentFlushRegistration'
import { applyPendingRawExitContent, resolvePendingRawExitContent, resolveRawModeContent } from './editorRawModeSync'
import { uploadEditorImage } from './editorImageUpload'
import { schema } from './editorSchema'
import { createImeCompositionKeyGuardExtension } from './imeCompositionKeyGuardExtension'
import { createMarkdownHighlightShortcutExtension } from './markdownHighlightShortcutExtension'
import { copyImagePath, openImageExternally } from './imageTabActions'
import { EmptyCard } from './EmptyCard'
import { ImageView } from './ImageView'
import { PathRow, type PathRowMode } from './PathRow'
import { RawEditorView } from './RawEditorView'
import type { RawEditorFindRequest } from './rawEditorFindTypes'
import { RichEditorFindBar } from './RichEditorFindBar'
import { createRichEditorFindExtension } from './richEditorFind'
import { Toast } from './Toast'
import { TabBar } from './TabBar'
import { RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS } from './richEditorBlockNoteOptions'
import { createRichEditorBlockSelectionExtension } from './richEditorBlockSelectionExtension'
import { createRichEditorCodeBlockArrowNavigationExtension } from './richEditorCodeBlockArrowNavigationExtension'
import { createRichEditorCodeBlockShortcutExtension } from './richEditorCodeBlockShortcutExtension'
import { createRichEditorCodeBlockTabExtension } from './richEditorCodeBlockTabExtension'
import { installRichEditorDispatchPerformanceProbe } from './richEditorDispatchPerformance'
import { createRichEditorEmptyListNavigationExtension } from './richEditorEmptyListNavigationExtension'
import { createRichEditorMarkdownInputTransformExtension } from './richEditorInputTransformExtension'
import { createRichEditorListTabExtension } from './richEditorListTabExtension'
import { createRichEditorPasteHandler } from './richEditorPaste'
import { createRichEditorTextDirectionExtension } from './richEditorTextDirection'
import { createRichEditorTransformErrorRecoveryExtension } from './richEditorTransformErrorRecoveryExtension'
import { SingleEditorView } from './SingleEditorView'
import { createTodoBlockShortcutExtension } from './todoBlockShortcutExtension'
import { useFilenameAutolinkGuard } from './useFilenameAutolinkGuard'
import { useRawModeWithFlush } from './useRawModeWithFlush'
import { WriteFailureBar } from './WriteFailureBar'
import './Editor.css'
import './EditorTheme.css'
import './EditorShell.css'

/**
 * Fuwa's editor shell (rewritten, not copied). It creates the
 * BlockNote editor with the kernel's schema and extensions, hands the open
 * Document to the kernel's tab-swap machinery, and draws the floating card
 * around it. Everything it mounts is copied from Tolaria.
 */

const RICH_EDITOR_BIDI_DOM_ATTRIBUTES = {
  blockContent: { dir: 'auto' },
  inlineContent: { dir: 'auto' },
}

const NO_WIKILINK_NAVIGATION = () => {}
const noop = () => {}
/** ⌘S in CodeMirror is the app's fileSave, which the window keydown already dispatches. */
const RAW_SAVE_HANDLED_BY_APP = () => {}
const RICH_UNAVAILABLE_REASON = 'Fix the frontmatter to use Rich mode'

type FlushPendingContentRef = MutableRefObject<((path: string) => void) | null>

export interface EditorProps {
  tabs: Tab[]
  activeTabPath: string | null
  /** The active Image Tab's row in the Folder listing: its byte size, and the version its picture is fetched at. */
  imageFile?: ListedFile | null
  /** The boundary root of the active Document: its Folder, or its own directory. */
  vaultPath?: string
  folder?: string | null
  hasPendingEditorContentRef?: MutableRefObject<((path: string) => boolean) | null>
  /** When the active Document's last write landed on disk. */
  savedAt: number | null
  /** Receives the serialized Markdown after the rich editor's idle debounce. */
  onContentChange?: (path: string, content: string) => void
  /** Receives the Raw editor's bytes after its own idle debounce, and on every flush. */
  onRawContentChange?: (path: string, content: string) => void
  /** Registers a flush of the rich editor's pending edits, so ⌘S saves the latest keystrokes. */
  flushPendingEditorContentRef?: FlushPendingContentRef
  /** Registers the same for the Raw editor's keystrokes. */
  flushPendingRawContentRef?: FlushPendingContentRef
  /** Toggle Rich/Raw (⌘\, View menu): the editor registers the switch here, since only it can map the caret. */
  rawToggleRef?: MutableRefObject<(() => void) | null>
  /** Find in the current Document (⌘F, Edit menu): the editor registers the request here and opens the bar of whichever surface is showing. */
  findRef?: MutableRefObject<(() => void) | null>
  /** Puts a Document Tab in Rich or Raw mode; the Tab rules decide whether it takes. */
  onSetTabMode: (path: string, mode: EditorMode) => void
  /** The tab bar's clicks. */
  onActivateTab: (path: string) => void
  onCloseTab: (path: string) => void
  /** The active Document's refused write, if its last write failed; the error bar's reason to exist. */
  writeFailure: WriteFailure | null
  onRetryWrite: (path: string) => void
  onDiscardWrite: (path: string) => void
  /** The Explorer's one line of bad news, at the bottom of the card. */
  toast: string | null
  /** Collapsed, the card goes edge-to-edge and its top row seats the traffic lights and the sidebar icon. */
  sidebarCollapsed: boolean
  onShowSidebar: () => void
}

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function useRichEditor(options: { activeTabPath: string | null; vaultPath?: string }) {
  const vaultPathRef = useLatestRef(options.vaultPath)
  const activeTabPathRef = useLatestRef(options.activeTabPath)

  const editor = useCreateBlockNote({
    ...RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS,
    schema,
    domAttributes: RICH_EDITOR_BIDI_DOM_ATTRIBUTES,
    // A pasted image lands in `attachments/` beside the Document; the block
    // holds its asset URL, which Autosave writes back as a relative path.
    uploadFile: (file: File) => uploadEditorImage(file, activeTabPathRef.current ? noteRootForPath(activeTabPathRef.current) : vaultPathRef.current),
    pasteHandler: createRichEditorPasteHandler(),
    tabBehavior: 'prefer-indent',
    _tiptapOptions: { injectNonce: RUNTIME_STYLE_NONCE },
    extensions: [
      createRichEditorTransformErrorRecoveryExtension(),
      createImeCompositionKeyGuardExtension(),
      createRichEditorCodeBlockArrowNavigationExtension(),
      createRichEditorEmptyListNavigationExtension(),
      createRichEditorCodeBlockTabExtension(),
      createRichEditorListTabExtension(),
      createRichEditorCodeBlockShortcutExtension(),
      createMarkdownHighlightShortcutExtension(),
      createTodoBlockShortcutExtension(),
      createRichEditorMarkdownInputTransformExtension(),
      createRichEditorTextDirectionExtension(),
      createRichEditorBlockSelectionExtension(),
      createRichEditorFindExtension(),
    ],
  })
  installRichEditorMarkdownSerializer(editor)
  useEffect(() => {
    installRichEditorDispatchPerformanceProbe(editor, () => activeTabPathRef.current)
  }, [activeTabPathRef, editor])
  useFilenameAutolinkGuard(editor)

  return editor
}

/** Registers a callback into an optional ref for as long as it is current. */
function useRegisteredRef<T>(ref: MutableRefObject<T | null> | undefined, value: T) {
  useEffect(() => {
    if (!ref) return
    ref.current = value
    return () => {
      if (ref.current === value) ref.current = null
    }
  }, [ref, value])
}

/**
 * Rich/Raw switching, carried from Tolaria: the kernel's hook
 * serializes the rich editor into the raw buffer on the way in, maps the
 * caret both ways, and remembers raw edits the Tab state has not caught up
 * with on the way out. Fuwa's deviation is where the mode lives: the active
 * Tab's `mode`, set through the Tab rules, so two Tabs can differ and the
 * Session restores each. A Document whose Frontmatter is invalid cannot
 * leave Raw; the toggle is a no-op there and the Rich segment says why.
 */
function useRawModeRuntime(options: {
  editor: ReturnType<typeof useRichEditor>
  tabs: Tab[]
  activeTab: Tab | null
  activeTabPath: string | null
  vaultPath?: string
  onRawContentChange?: (path: string, content: string) => void
  onSetTabMode: (path: string, mode: EditorMode) => void
  flushPendingEditorChangeRef: MutableRefObject<(() => boolean) | null>
}) {
  const { editor, tabs, activeTab, activeTabPath, vaultPath, onRawContentChange, onSetTabMode, flushPendingEditorChangeRef } = options
  const tabMode = useMemo(() => ({ mode: activeTab?.mode ?? null, setMode: onSetTabMode }), [activeTab?.mode, onSetTabMode])
  const {
    rawMode,
    handleToggleRaw,
    rawLatestContentRef,
    pendingRawExitContent,
    setPendingRawExitContent,
    rawModeContentOverride,
  } = useRawModeWithFlush(editor, activeTabPath, activeTab?.content ?? null, onRawContentChange, vaultPath, flushPendingEditorChangeRef, tabMode)

  // Raw edits are handed to the rich editor's swap before the Tab state has
  // them; once it does, the hand-over is cleared (derived, not effected).
  const resolvedExit = resolvePendingRawExitContent({ activeTabPath, tabs, pendingRawExitContent })
  if (resolvedExit !== pendingRawExitContent) setPendingRawExitContent(resolvedExit)
  const tabsForEditorSwap = useMemo(() => applyPendingRawExitContent(tabs, resolvedExit), [resolvedExit, tabs])
  const rawModeContent = resolveRawModeContent({ activeTab, rawModeContentOverride })

  const frontmatter = useMemo(() => documentFrontmatter(activeTab?.content ?? ''), [activeTab?.content])
  const richUnavailable = frontmatter.kind === 'invalid'
  const toggleRaw = useCallback(() => {
    if (rawMode && richUnavailable) return
    void handleToggleRaw()
  }, [handleToggleRaw, rawMode, richUnavailable])

  const pathRowMode = useMemo<PathRowMode>(() => ({
    value: rawMode ? 'raw' : 'rich',
    onChange: (mode) => {
      if ((mode === 'raw') !== rawMode) toggleRaw()
    },
    richDisabledReason: richUnavailable ? RICH_UNAVAILABLE_REASON : null,
    frontmatterLabel: frontmatterBadgeLabel(frontmatter),
  }), [frontmatter, rawMode, richUnavailable, toggleRaw])

  return { rawMode, toggleRaw, rawLatestContentRef, rawModeContent, tabsForEditorSwap, pathRowMode }
}

/**
 * An Image Tab has no editor under it, so the kernel is told there is no
 * active Document: the swap machinery blanks rather than trying to parse a
 * picture, and nothing registers a flush for a Tab that is never written.
 */
function useEditorRuntime(props: EditorProps) {
  const { tabs, vaultPath, onContentChange, onRawContentChange, onSetTabMode, flushPendingEditorContentRef, flushPendingRawContentRef, hasPendingEditorContentRef } = props
  const { documentPath: activeTabPath, imagePath: imageTabPath } = activeTabPaths(props.activeTabPath)
  const editor = useRichEditor({ activeTabPath, vaultPath })
  const activeTab = tabs.find((tab) => tab.entry.path === activeTabPath) ?? null
  const flushPendingEditorChangeRef = useRef<(() => boolean) | null>(null)
  const raw = useRawModeRuntime({ editor, tabs, activeTab, activeTabPath, vaultPath, onRawContentChange, onSetTabMode, flushPendingEditorChangeRef })
  const { handleEditorChange, flushPendingEditorChange, hasPendingEditorChange, editorMountedRef } = useEditorTabSwap({
    tabs: raw.tabsForEditorSwap,
    activeTabPath,
    editor,
    onContentChange,
    rawMode: raw.rawMode,
    vaultPath,
  })
  useRegisteredRef(flushPendingEditorChangeRef, flushPendingEditorChange)
  const { rawMode, rawLatestContentRef } = raw
  const activeTabContent = activeTab?.content ?? null
  // Whether the active Document has keystrokes its Tab does not hold yet, on whichever surface is showing.
  const hasPendingEditorContent = useCallback((path: string) => {
    if (path !== activeTabPath) return false
    if (rawMode) return rawLatestContentRef.current !== null && rawLatestContentRef.current !== activeTabContent
    return hasPendingEditorChange()
  }, [activeTabContent, activeTabPath, hasPendingEditorChange, rawLatestContentRef, rawMode])
  useRegisteredRef(hasPendingEditorContentRef, hasPendingEditorContent)
  useEditorFocus(editor, editorMountedRef)
  useRegisteredRef(props.rawToggleRef, raw.toggleRaw)
  const findRequest = useFindRequests(activeTabPath, raw.rawMode, props.findRef)

  useRegisterEditorContentFlushes({
    activeTab,
    flushPendingEditorChange,
    flushPendingEditorContentRef,
    rawLatestContentRef,
    rawMode,
    onContentChange: onRawContentChange,
    flushPendingRawContentRef,
  })

  return { editor, activeTab, handleEditorChange, imageTabPath, raw, findRequest }
}

/**
 * ⌘F and Edit → Find ask for the find bar through the registered ref; each
 * ask is a fresh request for the active Document, so a bar that is already
 * open refocuses its input and a closed one opens. Raw mode's carried bar and
 * the Rich bar both read the same request. A request belongs to the surface
 * it was made on (this Tab, in this mode): switching Tab or mode drops it, so
 * a bar that mounts later does not reopen on a stale ask.
 */
function useFindRequests(
  activeTabPath: string | null,
  rawMode: boolean,
  findRef: MutableRefObject<(() => void) | null> | undefined,
): RawEditorFindRequest | null {
  const surface = `${activeTabPath ?? ''}\n${rawMode ? 'raw' : 'rich'}`
  const [request, setRequest] = useState<{ surface: string; value: RawEditorFindRequest } | null>(null)
  const sequence = useRef(0)
  const requestFind = useCallback(() => {
    if (!activeTabPath) return
    sequence.current += 1
    setRequest({ surface, value: { id: sequence.current, path: activeTabPath, replace: false } })
  }, [activeTabPath, surface])
  useRegisteredRef(findRef, requestFind)
  return request !== null && request.surface === surface ? request.value : null
}

/**
 * The picture's natural size, which the path row's `1920 × 1080` half comes
 * from. There is none until the image has loaded, and none again the moment
 * the Tab or the file behind it changes — which is what `shownPicture`, the
 * path and fetch version together, identifies.
 */
function useImageNaturalSize(shownPicture: string) {
  const [naturalSize, setNaturalSize] = useState<ImageNaturalSize | null>(null)
  const [shown, setShown] = useState(shownPicture)
  if (shown !== shownPicture) {
    setShown(shownPicture)
    setNaturalSize(null)
  }
  return { naturalSize, setNaturalSize }
}

function EditorFindScope({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const scopeRef = useRef<HTMLDivElement | null>(null)
  useEditorFocusScope(scopeRef)
  const syncAvailability = useCallback(() => {
    const activeElement = document.activeElement
    const enabled = activeElement instanceof Node && scopeRef.current?.contains(activeElement) === true
    dispatchEditorFindAvailability(enabled)
  }, [])

  useEffect(() => () => dispatchEditorFindAvailability(false), [])

  return (
    <div
      ref={scopeRef}
      className={className}
      data-editor-find-scope="true"
      onFocusCapture={() => dispatchEditorFindAvailability(true)}
      onBlurCapture={() => requestAnimationFrame(syncAvailability)}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * An Image Tab's path row and body. The Folder listing is
 * where the byte size comes from and what says the file has changed on disk,
 * so a picture overwritten in another app is fetched again the moment the
 * watcher refreshes the Folder. There is no save state, no Frontmatter badge,
 * no Rich/Raw and no error bar: an Image Tab is never written.
 */
function ImageTab({ path, folder, imageFile, reloads }: {
  path: string
  folder?: string | null
  imageFile?: ListedFile | null
  reloads: number
}) {
  const fileSize = imageFile?.fileSize ?? 0
  const version = imageFetchVersion(imageFile ?? null, reloads)
  const { naturalSize, setNaturalSize } = useImageNaturalSize(`${path}@${version}`)
  const { cssVars } = useEditorTheme()
  const root = documentRoot(path, folder)
  const filename = notePathFilename(path)
  const openExternally = useCallback(() => openImageExternally(path, root), [path, root])

  return (
    <>
      <PathRow
        filename={filename}
        path={path}
        folder={folder}
        savedAt={null}
        image={{
          metadata: imageMetadataLabel(naturalSize, fileSize),
          onOpenExternal: openExternally,
          onCopyPath: () => copyImagePath(path),
        }}
      />
      <div className="fuwa-image-view-scope" style={cssVars as React.CSSProperties}>
        <ImageView
          path={path}
          filename={filename}
          version={version}
          onNaturalSize={setNaturalSize}
          onOpenExternal={openExternally}
        />
      </div>
    </>
  )
}

export const Editor = memo(function Editor(props: EditorProps) {
  const { editor, activeTab, handleEditorChange, imageTabPath, raw, findRequest } = useEditorRuntime(props)
  const {
    tabs, activeTabPath, vaultPath, savedAt, onActivateTab, onCloseTab, writeFailure, onRetryWrite, onDiscardWrite,
    sidebarCollapsed, onShowSidebar,
  } = props
  // theme.json's editor.maxWidth and paddingHorizontal (a 680px prose column
  // with 56px padding) reach the wrapper and .bn-editor as CSS variables.
  const { cssVars } = useEditorTheme()
  const openTab = tabs.find((tab) => tab.entry.path === activeTabPath) ?? null
  const collapsed = sidebarCollapsed || undefined

  if (!openTab) {
    return (
      <div className="fuwa-card" data-testid="editor-card" data-collapsed={collapsed}>
        <EmptyCard hasFolder={Boolean(props.folder)} sidebarCollapsed={sidebarCollapsed} onShowSidebar={onShowSidebar} />
        <Toast message={props.toast} />
      </div>
    )
  }

  return (
    <div className="fuwa-card" data-testid="editor-card" data-collapsed={collapsed}>
      <TabBar
        tabs={tabs}
        activeTabPath={activeTabPath}
        onActivate={onActivateTab}
        onClose={onCloseTab}
        sidebarCollapsed={sidebarCollapsed}
        onShowSidebar={onShowSidebar}
      />
      {/* The two bodies are exclusive: an Image Tab leaves the runtime with no active Document. */}
      {imageTabPath !== null && (
        <ImageTab path={imageTabPath} folder={props.folder} imageFile={props.imageFile} reloads={openTab.reloads ?? 0} />
      )}
      {activeTab && (
        <>
          <PathRow filename={activeTab.entry.filename} path={activeTab.entry.path} folder={props.folder} savedAt={savedAt} mode={raw.pathRowMode} />
          {writeFailure && (
            <WriteFailureBar
              path={writeFailure.path}
              message={writeFailure.message}
              onRetry={() => onRetryWrite(writeFailure.path)}
              onDiscard={() => onDiscardWrite(writeFailure.path)}
            />
          )}
          {/* The two surfaces are exclusive: Raw mode shows the exact bytes in CodeMirror and BlockNote is not mounted. */}
          {raw.rawMode ? (
            <EditorFindScope className="editor-scroll-area fuwa-raw-scope" style={cssVars as React.CSSProperties}>
              <RawEditorView
                key={activeTab.entry.path}
                content={raw.rawModeContent ?? activeTab.content}
                path={activeTab.entry.path}
                onContentChange={props.onRawContentChange ?? noop}
                onSave={RAW_SAVE_HANDLED_BY_APP}
                latestContentRef={raw.rawLatestContentRef}
                findRequest={findRequest}
              />
            </EditorFindScope>
          ) : (
            <EditorFindScope className="editor-scroll-area" style={cssVars as React.CSSProperties}>
              <RichEditorFindBar key={activeTab.entry.path} editor={editor} path={activeTab.entry.path} request={findRequest} />
              <div className="editor-content-wrapper">
                <SingleEditorView
                  editor={editor}
                  onNavigateWikilink={NO_WIKILINK_NAVIGATION}
                  onChange={handleEditorChange}
                  sourceEntry={activeTab.entry}
                  attachmentVaultPath={noteRootForPath(activeTab.entry.path)}
                  vaultPath={vaultPath}
                />
              </div>
            </EditorFindScope>
          )}
        </>
      )}
      <Toast message={props.toast} />
    </div>
  )
})
