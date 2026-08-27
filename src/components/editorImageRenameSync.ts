import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { updateBlock } from '@blocknote/core'
import type { useCreateBlockNote } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import { trackEvent } from '../lib/telemetry'
import { isTauri } from '../mock-tauri'
import { resolveVaultAttachmentPath } from '../utils/vaultAttachments'

type AttachmentRenameEditor = ReturnType<typeof useCreateBlockNote>
type AttachmentRenameChangeContext = { getChanges: () => unknown[] }

type AttachmentRenameRequest = {
  blockId: string
  previousName: string
  requestedName: string
  sourceUrl: string
}

type AttachmentRenameResult = {
  failedUpdates: number
  newName: string
  newPath: string
  updatedFiles: number
}

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null
}

function samePropsExceptName(current: RecordValue, previous: RecordValue): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)])
  keys.delete('name')
  return [...keys].every((key) => Reflect.get(current, key) === Reflect.get(previous, key))
}

function supportedChangeSource(change: RecordValue): boolean {
  const source = change.source
  if (!isRecord(source)) return false
  return ['local', 'undo', 'redo', 'undo-redo'].includes(String(source.type))
}

function imageUpdateBlocks(change: unknown): { block: RecordValue, previousBlock: RecordValue } | null {
  if (!isRecord(change)) return null
  if (change.type !== 'update') return null
  if (!supportedChangeSource(change)) return null
  if (!isRecord(change.block)) return null
  if (!isRecord(change.prevBlock)) return null
  if (change.block.type !== 'image') return null
  if (change.prevBlock.type !== 'image') return null
  return { block: change.block, previousBlock: change.prevBlock }
}

function imageProps(block: RecordValue): RecordValue | null {
  return isRecord(block.props) ? block.props : null
}

function renameStrings(
  block: RecordValue,
  props: RecordValue,
  previousProps: RecordValue,
): AttachmentRenameRequest | null {
  if (typeof block.id !== 'string') return null
  if (typeof props.name !== 'string') return null
  if (typeof previousProps.name !== 'string') return null
  if (typeof props.url !== 'string') return null
  if (props.url !== previousProps.url) return null
  if (props.name.trim() === '') return null
  if (props.name === previousProps.name) return null
  return {
    blockId: block.id,
    previousName: previousProps.name,
    requestedName: props.name,
    sourceUrl: props.url,
  }
}

export function attachmentRenameRequestForChange(change: unknown): AttachmentRenameRequest | null {
  const blocks = imageUpdateBlocks(change)
  if (!blocks) return null
  const props = imageProps(blocks.block)
  const previousProps = imageProps(blocks.previousBlock)
  if (!props || !previousProps) return null
  if (!samePropsExceptName(props, previousProps)) return null
  return renameStrings(blocks.block, props, previousProps)
}

function updateImageBlockWithoutHistory(
  editor: AttachmentRenameEditor,
  request: AttachmentRenameRequest,
  name: string,
  url: string,
): void {
  const view = editor.prosemirrorView
  const transaction = view.state.tr
  updateBlock(transaction, request.blockId, { props: { name, url } })
  transaction.setMeta('addToHistory', false)
  view.dispatch(transaction)
}

async function synchronizeRename(options: {
  editor: AttachmentRenameEditor
  request: AttachmentRenameRequest
  sourcePaths: Map<string, string>
  vaultPath: string
}): Promise<void> {
  const resolvedSource = resolveVaultAttachmentPath({
    url: options.request.sourceUrl,
    vaultPath: options.vaultPath,
  })
  const sourcePath = options.sourcePaths.get(options.request.blockId) ?? resolvedSource
  if (!sourcePath) return
  try {
    const result = await invoke<AttachmentRenameResult>('rename_attachment', {
      requestedName: options.request.requestedName,
      sourcePath,
      vaultPath: options.vaultPath,
    })
    options.sourcePaths.set(options.request.blockId, result.newPath)
    updateImageBlockWithoutHistory(
      options.editor,
      options.request,
      result.newName,
      convertFileSrc(result.newPath),
    )
    trackEvent('attachment_renamed', {
      failed_reference_updates: result.failedUpdates,
      normalized_or_collision_resolved: Number(result.newName !== options.request.requestedName),
      updated_note_count: result.updatedFiles,
    })
  } catch (error) {
    updateImageBlockWithoutHistory(
      options.editor,
      options.request,
      options.request.previousName,
      options.request.sourceUrl,
    )
    trackEvent('attachment_rename_failed')
    console.warn('[attachment] Failed to rename image:', error)
  }
}

export function useEditorImageRenameSync(
  editor: AttachmentRenameEditor,
  vaultPath: string,
): void {
  const pending = useRef(Promise.resolve())
  const sourcePaths = useRef(new Map<string, string>())

  useEffect(() => {
    const subscribe = editor.onChange
    if (typeof subscribe !== 'function') return undefined
    const handleChange = (
      _changedEditor: AttachmentRenameEditor,
      { getChanges }: AttachmentRenameChangeContext,
    ) => {
      if (!isTauri() || vaultPath.trim() === '') return
      for (const change of getChanges()) {
        const request = attachmentRenameRequestForChange(change)
        if (!request) continue
        pending.current = pending.current.then(() => synchronizeRename({
          editor,
          request,
          sourcePaths: sourcePaths.current,
          vaultPath,
        }))
      }
    }
    return subscribe.call(editor, handleChange)
  }, [editor, vaultPath])
}
