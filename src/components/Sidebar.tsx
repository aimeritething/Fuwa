import { useCallback, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { clampSidebarWidth } from '../utils/sessionSchema'
import { SidebarToggle } from './SidebarToggle'
import './Sidebar.css'

const KEYBOARD_RESIZE_STEP = 16

interface SidebarProps {
  width: number
  onWidthChange: (width: number) => void
  onToggle: () => void
  children?: ReactNode
}

/**
 * The sidebar (spec section 2): directly on the canvas, no border, no
 * surface of its own. Its 44px top row keeps the traffic lights at one y in
 * both states, drags the window, and carries the collapse icon at its right
 * end. The groups (Open Editors, the Explorer) stack below it. Its right
 * edge resizes it; the width reaches the Session once the drag ends.
 */
export function Sidebar({ width, onWidthChange, onToggle, children }: SidebarProps) {
  const { liveWidth, resizerProps } = useEdgeResize(width, onWidthChange)
  const style = { '--fuwa-sidebar-width': `${liveWidth ?? width}px` } as CSSProperties

  return (
    <aside className="fuwa-sidebar" data-testid="sidebar" data-resizing={liveWidth !== null || undefined} style={style}>
      <div className="fuwa-sidebar__top" data-tauri-drag-region>
        <SidebarToggle collapsed={false} onToggle={onToggle} />
      </div>
      {children}
      <div
        className="fuwa-sidebar__resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        tabIndex={0}
        {...resizerProps}
      />
    </aside>
  )
}

/**
 * The drag on the sidebar's edge. The width follows the pointer through
 * local state and is handed on once, at release, so the Session is written
 * once per drag rather than once per pointer move.
 */
function useEdgeResize(width: number, onWidthChange: (width: number) => void) {
  const [drag, setDrag] = useState<{ originX: number; originWidth: number; width: number } | null>(null)

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ originX: event.clientX, originWidth: width, width })
  }, [width])

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setDrag((prev) => (prev ? { ...prev, width: clampSidebarWidth(prev.originWidth + event.clientX - prev.originX) } : prev))
  }, [])

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (drag) onWidthChange(drag.width)
    setDrag(null)
  }, [drag, onWidthChange])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? KEYBOARD_RESIZE_STEP : event.key === 'ArrowLeft' ? -KEYBOARD_RESIZE_STEP : 0
    if (step === 0) return
    event.preventDefault()
    onWidthChange(clampSidebarWidth(width + step))
  }, [onWidthChange, width])

  return {
    liveWidth: drag?.width ?? null,
    resizerProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  }
}
