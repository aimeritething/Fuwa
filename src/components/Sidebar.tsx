import type { ReactNode } from 'react'
import './Sidebar.css'

/**
 * The sidebar (spec section 2): directly on the canvas, no border, no
 * surface of its own. Its 44px top row keeps the traffic lights at one y
 * and drags the window. The groups (Open Editors here, the Explorer with
 * AIM-383) stack below it.
 */
export function Sidebar({ children }: { children?: ReactNode }) {
  return (
    <aside className="fuwa-sidebar" data-testid="sidebar">
      <div className="fuwa-sidebar__top" data-tauri-drag-region aria-hidden="true" />
      {children}
    </aside>
  )
}
