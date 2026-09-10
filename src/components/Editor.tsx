import { memo, useCallback, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import 'katex/dist/katex.min.css'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { useEditorFocus } from '../hooks/useEditorFocus'
import { useEditorTheme } from '../hooks/useTheme'
import { useEditorFocusScope } from '../hooks/editorFocusOwnership'
import {
  emptyImageUploadResult,
  isUnsupportedImageFormatError,
  uploadImageFile,
  type UploadImageFileResult,
} from '../hooks/useImageDrop'
import { RUNTIME_STYLE_NONCE } from '../lib/runtimeStyleNonce'
import type { Tab } from '../types'
import { dispatchEditorFindAvailability } from '../utils/editorFindEvents'
import { installRichEditorMarkdownSerializer } from '../utils/richEditorMarkdown'
import { useRegisterEditorContentFlushes } from './editorContentFlushRegistration'
import { schema } from './editorSchema'
import { createImeCompositionKeyGuardExtension } from './imeCompositionKeyGuardExtension'
import { createMarkdownHighlightShortcutExtension } from './markdownHighlightShortcutExtension'
import { PathRow } from './PathRow'
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
  /** The boundary root of the active Document: its Folder, or its own directory. */
  vaultPath?: string
  /** When the active Document's last write landed on disk. */
  savedAt: number | null
  /** Receives the serialized Markdown after the rich editor's idle debounce. */
  onContentChange?: (path: string, content: string) => void
  /** Registers a flush of the rich editor's pending edits, so ⌘S saves the latest keystrokes. */
  flushPendingEditorContentRef?: FlushPendingContentRef
  /** The tab bar's clicks. */
  onActivateTab: (path: string) => void
  onCloseTab: (path: string) => void
}

/** Images arrive with AIM-384; until then an unsupported format is logged, not surfaced. */
function handleEditorImageUploadFailure(file: File, error: unknown): UploadImageFileResult {
  if (!isUnsupportedImageFormatError(error)) throw error

  console.warn('[editor] Unsupported image format:', error.message)
  return emptyImageUploadResult(file)
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
    uploadFile: async (file: File) => {
      try {
        return await uploadImageFile(file, vaultPathRef.current)
      } catch (error) {
        return handleEditorImageUploadFailure(file, error)
      }
    },
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

function useEditorRuntime(props: EditorProps) {
  const { tabs, activeTabPath, vaultPath, onContentChange, flushPendingEditorContentRef } = props
  const editor = useRichEditor({ activeTabPath, vaultPath })
  const activeTab = tabs.find((tab) => tab.entry.path === activeTabPath) ?? null
  const { handleEditorChange, flushPendingEditorChange, editorMountedRef } = useEditorTabSwap({
    tabs,
    activeTabPath,
    editor,
    onContentChange,
    rawMode: false,
    vaultPath,
  })
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

  return { editor, activeTab, handleEditorChange }
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

export const Editor = memo(function Editor(props: EditorProps) {
  const { editor, activeTab, handleEditorChange } = useEditorRuntime(props)
  const { tabs, activeTabPath, vaultPath, savedAt, onActivateTab, onCloseTab } = props
  // theme.json's editor.maxWidth and paddingHorizontal (spec: a 680px prose
  // column with 56px padding) reach the wrapper and .bn-editor as CSS variables.
  const { cssVars } = useEditorTheme()

  return (
    <div className="fuwa-card" data-testid="editor-card">
      {activeTab ? (
        <>
          <TabBar tabs={tabs} activeTabPath={activeTabPath} onActivate={onActivateTab} onClose={onCloseTab} />
          <PathRow filename={activeTab.entry.filename} savedAt={savedAt} />
          <EditorFindScope className="editor-scroll-area" style={cssVars as React.CSSProperties}>
            <div className="editor-content-wrapper">
              <SingleEditorView
                editor={editor}
                onNavigateWikilink={NO_WIKILINK_NAVIGATION}
                onChange={handleEditorChange}
                sourceEntry={activeTab.entry}
                vaultPath={vaultPath}
              />
            </div>
          </EditorFindScope>
        </>
      ) : (
        <>
          <div className="fuwa-card__top" data-tauri-drag-region aria-hidden="true" />
          <EmptyCard />
        </>
      )}
    </div>
  )
})
