import { trackEvent } from '../lib/telemetry'
import { vaultAttachmentAssetUrl } from '../utils/vaultAttachments'
import {
  clipboardRemoteImages,
  importRemoteImages,
  type RemoteImageImportResult,
  type RemotePasteImage,
} from '../utils/remoteImagePaste'

type PasteHandlerOptions = {
  plainTextAsMarkdown?: boolean
  prioritizeMarkdownOverHTML?: boolean
}

type PasteBlock = {
  children?: PasteBlock[]
  id?: string
  props?: Record<string, unknown>
  type?: string
}

type RichPasteEditor = {
  document?: PasteBlock[]
  pasteText: (text: string) => boolean | undefined
  updateBlock?: (blockId: string, update: { props: { url: string } }) => void
}

export type RichEditorPasteContext = {
  defaultPasteHandler: (options?: PasteHandlerOptions) => boolean | undefined
  editor: RichPasteEditor
  event: ClipboardEvent
}

const EXPLICIT_MARKDOWN_TYPES = new Set(['blocknote/html', 'text/markdown'])
const BLOCKNOTE_HTML_MIME_TYPE = 'blocknote/html'
const HTML_MIME_TYPE = 'text/html'
const HTML_IMAGE_TAG_RE = /<img(?:\s|>|\/)/iu
const ANGLE_BRACKETED_TEXT_RE = /<[^<>\r\n]+>/u
const SPACED_LITERAL_ASTERISK_RE = /\S\s+\*\s+\S/u
const PREFIX_GLOB_ASTERISK_RE = /(?:^|\s)\*(?![*\s])[\w./-]+(?=\s|$)/u
const SUFFIX_GLOB_ASTERISK_RE = /(?:^|\s)[\w./-]+\*(?=\s|$)/u

type ImportRemoteImages = (request: {
  images: RemotePasteImage[]
  vaultPath: string
}) => Promise<RemoteImageImportResult>

type RichPasteHandlerOptions = {
  canApply?: () => boolean
  getVaultPath: () => string | undefined
  importImages?: ImportRemoteImages
  onImportResult?: (result: Pick<RemoteImageImportResult, 'failedCount' | 'totalCount'>) => void
}

type ActiveRichPasteHandlerOptions = Omit<RichPasteHandlerOptions, 'getVaultPath'> & {
  vaultPath?: string
}

function hasExplicitMarkdownPayload(clipboardData: DataTransfer): boolean {
  return Array.from(clipboardData.types).some(type => EXPLICIT_MARKDOWN_TYPES.has(type))
}

function shouldPastePlainTextLiterally(text: string): boolean {
  return ANGLE_BRACKETED_TEXT_RE.test(text)
    || SPACED_LITERAL_ASTERISK_RE.test(text)
    || PREFIX_GLOB_ASTERISK_RE.test(text)
    || SUFFIX_GLOB_ASTERISK_RE.test(text)
}

function literalPlainText(clipboardData: DataTransfer | null): string | null {
  if (!clipboardData) return null

  const plainText = clipboardData.getData('text/plain')
  if (plainText.length === 0) return null
  if (hasExplicitMarkdownPayload(clipboardData)) return null
  if (!shouldPastePlainTextLiterally(plainText)) return null

  return plainText
}

function shouldPasteHTMLImagesFromHTML(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false
  if (Array.from(clipboardData.types).includes(BLOCKNOTE_HTML_MIME_TYPE)) return false

  return HTML_IMAGE_TAG_RE.test(clipboardData.getData(HTML_MIME_TYPE))
}

export function handleRichEditorPaste({
  defaultPasteHandler,
  editor,
  event,
}: RichEditorPasteContext): boolean | undefined {
  if (shouldPasteHTMLImagesFromHTML(event.clipboardData)) {
    return defaultPasteHandler({ prioritizeMarkdownOverHTML: false })
  }

  const plainText = literalPlainText(event.clipboardData)
  if (plainText) return editor.pasteText(plainText)

  return defaultPasteHandler()
}

function replaceRichImageBlockUrls(
  blocks: PasteBlock[],
  replacements: ReadonlyMap<string, string>,
  updateBlock: NonNullable<RichPasteEditor['updateBlock']>,
  vaultPath: string,
): void {
  for (const block of blocks) {
    const url = block.type === 'image' ? block.props?.url : undefined
    if (typeof url === 'string' && typeof block.id === 'string') {
      const attachmentPath = replacements.get(url)
      if (attachmentPath) {
        updateBlock(block.id, {
          props: { url: vaultAttachmentAssetUrl({ attachmentPath, vaultPath }) },
        })
      }
    }
    if (block.children) {
      replaceRichImageBlockUrls(block.children, replacements, updateBlock, vaultPath)
    }
  }
}

function finishRichRemoteImageImport(
  context: RichEditorPasteContext,
  options: ActiveRichPasteHandlerOptions,
  result: RemoteImageImportResult,
  vaultPath: string,
): void {
  const target = richImageRewriteTarget(context, options)
  if (target) {
    replaceRichImageBlockUrls(
      target.blocks,
      result.replacements,
      target.updateBlock,
      vaultPath,
    )
  }
  options.onImportResult?.({
    failedCount: result.failedCount,
    totalCount: result.totalCount,
  })
  trackEvent('remote_images_paste_imported', {
    surface: 'rich_editor',
    total_count: result.totalCount,
    success_count: result.totalCount - result.failedCount,
    failure_count: result.failedCount,
  })
}

function richImageRewriteTarget(
  context: RichEditorPasteContext,
  options: ActiveRichPasteHandlerOptions,
): { blocks: PasteBlock[]; updateBlock: NonNullable<RichPasteEditor['updateBlock']> } | null {
  if (options.canApply?.() === false) return null
  const blocks = context.editor.document
  const updateBlock = context.editor.updateBlock?.bind(context.editor)
  if (!blocks || !updateBlock) return null
  return { blocks, updateBlock }
}

export function createRichEditorPasteHandler(
  options: RichPasteHandlerOptions,
): (context: RichEditorPasteContext) => boolean | undefined {
  return context => handleRemoteRichEditorPaste(context, {
    canApply: options.canApply,
    importImages: options.importImages,
    onImportResult: options.onImportResult,
    vaultPath: options.getVaultPath(),
  })
}

export function handleRemoteRichEditorPaste(
  context: RichEditorPasteContext,
  options: ActiveRichPasteHandlerOptions,
): boolean | undefined {
  const images = context.event.clipboardData
    ? clipboardRemoteImages(context.event.clipboardData)
    : []
  const handled = handleRichEditorPaste(context)
  if (images.length === 0 || !options.vaultPath) return handled

  const importImages = options.importImages ?? importRemoteImages
  const vaultPath = options.vaultPath
  void importImages({ images, vaultPath }).then(result => {
    finishRichRemoteImageImport(context, options, result, vaultPath)
  })
  return handled
}
