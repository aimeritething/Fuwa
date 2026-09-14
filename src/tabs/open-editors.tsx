import { memo } from 'react'
import { FileText, Image } from '@phosphor-icons/react'
import type { Tab } from '@/types'
import { isImageFilePath } from './image-file'
import { documentLocation } from '@/folder/explorer'
import { CloseAffordance } from './close-affordance'

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
      <div className="flex h-6 flex-none cursor-default items-center px-2 text-[12px] text-text-secondary">{LABEL}</div>
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
  const Icon = isImageFilePath(path) ? Image : FileText
  return (
    <div
      className="group flex h-7 cursor-default items-center gap-1.5 rounded-lg pr-1.5 pl-2 whitespace-nowrap text-text-secondary outline-none hover:bg-sidebar-row-hover hover:text-text-heading focus-visible:focus-ring aria-selected:bg-sidebar-row-active aria-selected:text-text-heading"
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
      <Icon size={14} className="flex-none text-text-secondary group-hover:text-text-primary group-aria-selected:text-text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate" data-testid="open-editor-name">{filename}</span>
      {parent && <span className="flex-[0_1_auto] truncate text-[11px] text-text-secondary" data-testid="open-editor-parent">{parent}</span>}
      <CloseAffordance name={filename} onClose={() => onClose(path)} />
    </div>
  )
}
