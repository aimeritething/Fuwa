import { useEffect, useEffectEvent, type RefObject } from 'react'
import { clearDraggedNotePath, readDraggedNotePath } from '../components/note-retargeting/noteDragData'
import { relativePathStem } from '../utils/wikilink'

const MARKDOWN_NOTE_PATH = /\.md$/i
const NOTE_DROP_EVENT_OPTIONS = { capture: true }

interface UseNoteWikilinkDropOptions {
  containerRef: RefObject<HTMLElement | null>
  onInsertTarget: (target: string) => void
  vaultPath?: string
}

function droppedNoteWikilinkTarget(dataTransfer: DataTransfer | null, vaultPath?: string): string | null {
  if (!vaultPath) return null

  const notePath = readDraggedNotePath(dataTransfer)?.trim() ?? ''
  if (!MARKDOWN_NOTE_PATH.test(notePath)) return null

  return relativePathStem(notePath, vaultPath)
}

function claimNoteDropEvent(event: DragEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'link'
}

export function useNoteWikilinkDrop({
  containerRef,
  onInsertTarget,
  vaultPath,
}: UseNoteWikilinkDropOptions) {
  const handleDragOver = useEffectEvent((event: DragEvent) => {
    if (!droppedNoteWikilinkTarget(event.dataTransfer, vaultPath)) return

    claimNoteDropEvent(event)
  })

  const handleDrop = useEffectEvent((event: DragEvent) => {
    const target = droppedNoteWikilinkTarget(event.dataTransfer, vaultPath)
    if (!target) return

    claimNoteDropEvent(event)
    try {
      onInsertTarget(target)
    } finally {
      clearDraggedNotePath()
    }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('dragenter', handleDragOver, NOTE_DROP_EVENT_OPTIONS)
    container.addEventListener('dragover', handleDragOver, NOTE_DROP_EVENT_OPTIONS)
    container.addEventListener('drop', handleDrop, NOTE_DROP_EVENT_OPTIONS)

    return () => {
      container.removeEventListener('dragenter', handleDragOver, NOTE_DROP_EVENT_OPTIONS)
      container.removeEventListener('dragover', handleDragOver, NOTE_DROP_EVENT_OPTIONS)
      container.removeEventListener('drop', handleDrop, NOTE_DROP_EVENT_OPTIONS)
    }
  }, [containerRef])
}
