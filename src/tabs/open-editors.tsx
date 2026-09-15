import { memo } from 'react'
import { FileText, Image } from '@phosphor-icons/react'
import type { Tab } from '@/types'
import { isImageFilePath } from './image-file'
import { documentLocation } from '@/folder/explorer'
import { CloseAffordance } from './close-affordance'
import { SidebarLabel, SidebarRow, SidebarRowIcon, SidebarRowName } from '@/shell/sidebar-row'

export interface OpenEditorsProps {
  folder?: string | null
  tabs: Tab[]
  activeTabPath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

const LABEL = 'Open Editors'

/**
 * The Open Editors sidebar group: a quiet label, one row per
 * open Tab mirroring the tab bar, the active row selected, a close affordance
 * on hover. Not rendered at all with zero Tabs. Outside the Folder, rows
 * show the parent directory dimmed after the file name. A row's icon is the
 * Explorer's: a Document's page, an Image file's picture.
 */
export const OpenEditors = memo(function OpenEditors({ tabs, folder, activeTabPath, onActivate, onClose }: OpenEditorsProps) {
  if (tabs.length === 0) return null

  return (
    <section className="flex flex-none flex-col" data-testid="open-editors">
      <SidebarLabel>{LABEL}</SidebarLabel>
      <div className="flex flex-col gap-px" role="listbox" aria-label={LABEL}>
        {tabs.map(({ entry }) => (
          <OpenEditorRow
            key={entry.path}
            path={entry.path}
            filename={entry.filename}
            parent={folder !== undefined && !documentLocation(entry.path, folder).insideFolder ? documentLocation(entry.path, folder).parent : undefined}
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
  parent?: string
  path: string
  filename: string
  active: boolean
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

function OpenEditorRow({ path, filename, parent, active, onActivate, onClose }: OpenEditorRowProps) {
  return (
    <SidebarRow
      role="option"
      aria-selected={active}
      aria-label={filename}
      tabIndex={active ? 0 : -1}
      title={path}
      data-testid={`open-editor:${path}`}
      onClick={() => onActivate(path)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onActivate(path)
      }}
    >
      <SidebarRowIcon icon={isImageFilePath(path) ? Image : FileText} />
      <SidebarRowName data-testid="open-editor-name">{filename}</SidebarRowName>
      {parent && <span className="flex-initial truncate text-2xs text-text-secondary" data-testid="open-editor-parent">{parent}</span>}
      <CloseAffordance name={filename} onClose={() => onClose(path)} />
    </SidebarRow>
  )
}
