import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { clearDraggedNotePath } from '../components/note-retargeting/noteDragData'
import { useNoteWikilinkDrop } from './useNoteWikilinkDrop'

const NOTE_DRAG_MIME = 'application/x-laputa-note-path'

function createMockDataTransfer(seedData: Record<string, string>): DataTransfer {
  const data = new Map(Object.entries(seedData))
  const types = Array.from(data.keys())

  return {
    dropEffect: 'none',
    effectAllowed: 'move',
    setData(type: string, value: string) {
      data.set(type, value)
      if (!types.includes(type)) types.push(type)
    },
    getData(type: string) {
      return data.get(type) ?? ''
    },
    clearData() {
      data.clear()
      types.splice(0, types.length)
    },
    get types() {
      return types
    },
  } as DataTransfer
}

function createDragEvent(type: 'dragover' | 'drop', dataTransfer: DataTransfer): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return event
}

function NoteDropHarness({
  onInsertTarget,
  vaultPath = '/vault',
}: {
  onInsertTarget: (target: string) => void
  vaultPath?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useNoteWikilinkDrop({ containerRef, onInsertTarget, vaultPath })

  return (
    <div data-testid="note-drop-container" ref={containerRef}>
      <div data-testid="note-drop-child">Editor body</div>
    </div>
  )
}

describe('useNoteWikilinkDrop', () => {
  afterEach(() => {
    clearDraggedNotePath()
  })

  it('claims note dragover events before editor internals handle them', () => {
    render(<NoteDropHarness onInsertTarget={vi.fn()} />)
    const container = screen.getByTestId('note-drop-container')
    const child = screen.getByTestId('note-drop-child')
    const editorDragOver = vi.fn()
    container.addEventListener('dragover', editorDragOver)
    const dataTransfer = createMockDataTransfer({
      [NOTE_DRAG_MIME]: '/vault/Projects/Alpha.md',
      'text/plain': '/vault/Projects/Alpha.md',
    })

    child.dispatchEvent(createDragEvent('dragover', dataTransfer))

    expect(editorDragOver).not.toHaveBeenCalled()
    expect(dataTransfer.dropEffect).toBe('link')
  })

  it('claims note drops before editor internals handle them', () => {
    const onInsertTarget = vi.fn()
    render(<NoteDropHarness onInsertTarget={onInsertTarget} />)
    const container = screen.getByTestId('note-drop-container')
    const child = screen.getByTestId('note-drop-child')
    const editorDrop = vi.fn()
    container.addEventListener('drop', editorDrop)

    child.dispatchEvent(createDragEvent('drop', createMockDataTransfer({
      [NOTE_DRAG_MIME]: '/vault/Projects/Alpha.md',
      'text/plain': '/vault/Projects/Alpha.md',
    })))

    expect(editorDrop).not.toHaveBeenCalled()
    expect(onInsertTarget).toHaveBeenCalledWith('Projects/Alpha')
  })
})
