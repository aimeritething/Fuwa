import { memo } from 'react'
import { FileText } from '@phosphor-icons/react'
import type { Tab } from '../types'
import { CloseAffordance } from './CloseAffordance'
import './Sidebar.css'

export interface OpenEditorsProps {
  tabs: Tab[]
  activeTabPath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

const LABEL = 'Open Editors'

/**
 * The Open Editors sidebar group (spec section 2): a quiet label, one row per
 * open Tab mirroring the tab bar, the active row selected, a close affordance
 * on hover. Not rendered at all with zero Tabs. Rows show the file name; the
 * dimmed parent for out-of-Folder files arrives with the Folder (AIM-383).
 */
export const OpenEditors = memo(function OpenEditors({ tabs, activeTabPath, onActivate, onClose }: OpenEditorsProps) {
  if (tabs.length === 0) return null

  return (
    <section className="fuwa-open-editors" data-testid="open-editors">
      <div className="fuwa-sidebar__label">{LABEL}</div>
      <div className="fuwa-open-editors__rows" role="listbox" aria-label={LABEL}>
        {tabs.map(({ entry }) => (
          <OpenEditorRow
            key={entry.path}
            path={entry.path}
            filename={entry.filename}
            active={entry.path === activeTabPath}
            onActivate={onActivate}
            onClose={onClose}
          />
        ))}
      </div>
    </section>
  )
})

interface OpenEditorRowProps {
  path: string
  filename: string
  active: boolean
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

function OpenEditorRow({ path, filename, active, onActivate, onClose }: OpenEditorRowProps) {
  return (
    <div
      className="fuwa-sidebar-row"
      role="option"
      aria-selected={active}
      aria-label={filename}
      tabIndex={active ? 0 : -1}
      title={path}
      data-testid={`open-editor:${path}`}
      data-active={active || undefined}
      onClick={() => onActivate(path)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onActivate(path)
      }}
    >
      <FileText size={14} className="fuwa-sidebar-row__icon" aria-hidden="true" />
      <span className="fuwa-sidebar-row__name">{filename}</span>
      <CloseAffordance name={filename} onClose={() => onClose(path)} />
    </div>
  )
}
