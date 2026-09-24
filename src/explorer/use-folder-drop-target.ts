import { useMemo, useState, type DragEvent } from 'react'
import { clearDraggedNotePath, readDraggedNotePath } from './note-drag-drop'

/**
 * Where a dragged Document or Image file can land: a folder row, or the
 * Folder's own top level (the Explorer's header and the empty area below the
 * tree). The dragged path is read off the drag or, when the browser hides the
 * data, from the drag in progress. `destination` null takes no drop at all.
 */
export function useFolderDropTarget(destination: string | null, moveInto: (path: string, destination: string) => void) {
  const [isDropTarget, setDropTarget] = useState(false)

  const dropProps = useMemo(() => (destination === null ? {} : {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!readDraggedNotePath(event.dataTransfer)) return
      // Taking the event is what tells the browser this element accepts the drop.
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTarget(true)
    },
    onDragLeave: () => setDropTarget(false),
    onDrop: (event: DragEvent<HTMLElement>) => {
      const dragged = readDraggedNotePath(event.dataTransfer)
      setDropTarget(false)
      clearDraggedNotePath()
      if (!dragged) return
      event.preventDefault()
      moveInto(dragged, destination)
    },
  }), [destination, moveInto])

  return { dropProps, isDropTarget }
}
