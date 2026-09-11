import { memo, useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import 'katex/dist/katex.min.css'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { useEditorFocus } from '../hooks/useEditorFocus'
import { useEditorTheme } from '../hooks/useTheme'
import { useEditorFocusScope } from '../hooks/editorFocusOwnership'
import { RUNTIME_STYLE_NONCE } from '../lib/runtimeStyleNonce'
import type { Tab } from '../types'
import type { ListedFile } from '../utils/explorer'
import { documentRoot } from '../utils/explorer'
import { activeTabPaths, imageFetchVersion, imageMetadataLabel, type ImageNaturalSize } from '../utils/imageFile'
import { noteRootForPath } from '../utils/noteEntry'
import { notePathFilename } from '../utils/notePathIdentity'
import { dispatchEditorFindAvailability } from '../utils/editorFindEvents'
import { installRichEditorMarkdownSerializer } from '../utils/richEditorMarkdown'
import type { WriteFailure } from '../hooks/useWriteFailures'
import { useRegisterEditorContentFlushes } from './editorContentFlushRegistration'
import { uploadEditorImage } from './editorImageUpload'
import { schema } from './editorSchema'
import { createImeCompositionKeyGuardExtension } from './imeCompositionKeyGuardExtension'
import { createMarkdownHighlightShortcutExtension } from './markdownHighlightShortcutExtension'
import { copyImagePath, openImageExternally } from './imageTabActions'
import { ImageView } from './ImageView'
import { PathRow } from './PathRow'
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
import { WriteFailureBar } from './WriteFailureBar'
import './Editor.css'
import './EditorTheme.css'
import './EditorShell.css'

/**
 * Fuwa's editor shell (ADR-0001: rewritten, not copied). It creates the
 * BlockNote editor with the kernel's schema and extensions, hands the open
 * Document to the kernel's tab-swap machinery, and draws the floating card
 * around it. Everything it mounts is copied from Tolaria.
 */

const RICH_EDITOR_BIDI_DOM_ATTRIBUTES = {
  blockContent: { dir: 'auto' },
  inlineContent: { dir: 'auto' },
}

const NO_WIKILINK_NAVIGATION = () => {}

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
  /** Registers a flush of the rich editor's pending edits, so ⌘S saves the latest keystrokes. */
  flushPendingEditorContentRef?: FlushPendingContentRef
  /** The tab bar's clicks. */
  onActivateTab: (path: string) => void
  onCloseTab: (path: string) => void
  /** The active Document's refused write, if its last write failed; the error bar's reason to exist. */
  writeFailure: WriteFailure | null
  onRetryWrite: (path: string) => void
  onDiscardWrite: (path: string) => void
  /** The Explorer's one line of bad news, at the bottom of the card. */
  toast: string | null
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
    ],
  })
  installRichEditorMarkdownSerializer(editor)
  useEffect(() => {
    installRichEditorDispatchPerformanceProbe(editor, () => activeTabPathRef.current)
  }, [activeTabPathRef, editor])
  useFilenameAutolinkGuard(editor)

  return editor
}

/**
 * An Image Tab has no editor under it, so the kernel is told there is no
 * active Document: the swap machinery blanks rather than trying to parse a
 * picture, and nothing registers a flush for a Tab that is never written.
 */
function useEditorRuntime(props: EditorProps) {
  const { tabs, vaultPath, onContentChange, flushPendingEditorContentRef, hasPendingEditorContentRef } = props
  const { documentPath: activeTabPath, imagePath: imageTabPath } = activeTabPaths(props.activeTabPath)
  const editor = useRichEditor({ activeTabPath, vaultPath })
  const activeTab = tabs.find((tab) => tab.entry.path === activeTabPath) ?? null
  const { handleEditorChange, flushPendingEditorChange, hasPendingEditorChange, editorMountedRef } = useEditorTabSwap({
    tabs,
    activeTabPath,
    editor,
    onContentChange,
    rawMode: false,
    vaultPath,
  })
  useEffect(() => {
    if (!hasPendingEditorContentRef) return
    hasPendingEditorContentRef.current = (path) => path === activeTabPath && hasPendingEditorChange()
    return () => { hasPendingEditorContentRef.current = null }
  }, [activeTabPath, hasPendingEditorChange, hasPendingEditorContentRef])
  useEditorFocus(editor, editorMountedRef)

  // Raw mode arrives with AIM-381; until then the raw flush has nothing to register.
  const rawLatestContentRef = useRef<string | null>(null)
  useRegisterEditorContentFlushes({
    activeTab,
    flushPendingEditorChange,
    flushPendingEditorContentRef,
    rawLatestContentRef,
    rawMode: false,
  })

  return { editor, activeTab, handleEditorChange, imageTabPath }
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

function EmptyCard() {
  return (
    <div className="fuwa-empty" data-testid="editor-empty-state">
      <span className="fuwa-empty__wordmark">Fuwa</span>
      <div className="fuwa-empty__hints">
        <span><b>⌘⇧O</b>open document</span>
      </div>
    </div>
  )
}

/**
 * An Image Tab's path row and body (spec section 4). The Folder listing is
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
  const { editor, activeTab, handleEditorChange, imageTabPath } = useEditorRuntime(props)
  const { tabs, activeTabPath, vaultPath, savedAt, onActivateTab, onCloseTab, writeFailure, onRetryWrite, onDiscardWrite } = props
  // theme.json's editor.maxWidth and paddingHorizontal (spec: a 680px prose
  // column with 56px padding) reach the wrapper and .bn-editor as CSS variables.
  const { cssVars } = useEditorTheme()
  const openTab = tabs.find((tab) => tab.entry.path === activeTabPath) ?? null

  if (!openTab) {
    return (
      <div className="fuwa-card" data-testid="editor-card">
        <div className="fuwa-card__top" data-tauri-drag-region aria-hidden="true" />
        <EmptyCard />
        <Toast message={props.toast} />
      </div>
    )
  }

  return (
    <div className="fuwa-card" data-testid="editor-card">
      <TabBar tabs={tabs} activeTabPath={activeTabPath} onActivate={onActivateTab} onClose={onCloseTab} />
      {/* The two bodies are exclusive: an Image Tab leaves the runtime with no active Document. */}
      {imageTabPath !== null && (
        <ImageTab path={imageTabPath} folder={props.folder} imageFile={props.imageFile} reloads={openTab.reloads ?? 0} />
      )}
      {activeTab && (
        <>
          <PathRow filename={activeTab.entry.filename} path={activeTab.entry.path} folder={props.folder} savedAt={savedAt} />
          {writeFailure && (
            <WriteFailureBar
              path={writeFailure.path}
              message={writeFailure.message}
              onRetry={() => onRetryWrite(writeFailure.path)}
              onDiscard={() => onDiscardWrite(writeFailure.path)}
            />
          )}
          <EditorFindScope className="editor-scroll-area" style={cssVars as React.CSSProperties}>
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
        </>
      )}
      <Toast message={props.toast} />
    </div>
  )
})
