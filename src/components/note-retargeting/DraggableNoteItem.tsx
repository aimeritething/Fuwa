import type { DragEvent, ReactNode } from 'react'
import { writeDraggedNotePath } from './noteDragData'

interface DraggableNoteItemProps {
  notePath: string
  children: ReactNode
}

export function DraggableNoteItem({ notePath, children }: DraggableNoteItemProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    writeDraggedNotePath(event, notePath)
  }

  return (
    <div
      draggable
      data-testid={`draggable-note:${notePath}`}
      className="cursor-grab active:cursor-grabbing"
      onDragStart={handleDragStart}
    >
      {children}
    </div>
  )
}
