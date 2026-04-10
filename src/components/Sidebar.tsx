import { useState, useRef, useCallback, memo } from 'react'
import type { VaultEntry, FolderNode, SidebarSelection, ViewFile } from '../types'
import {
  KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { FolderTree } from './FolderTree'
import {
  applyCustomization,
  computeReorder,
  useEntryCounts,
  useOutsideClick,
  useSidebarCollapsed,
  useSidebarSections,
} from './sidebar/sidebarHooks'
import {
  ContextMenuOverlay,
  CustomizeOverlay,
  FavoritesSection,
  type SidebarSectionProps,
  SidebarTitleBar,
  SidebarTopNav,
  TypesSection,
  ViewsSection,
} from './sidebar/SidebarSections'

interface SidebarProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onCreateType?: (type: string) => void
  onCreateNewType?: () => void
  onCustomizeType?: (typeName: string, icon: string, color: string) => void
  onUpdateTypeTemplate?: (typeName: string, template: string) => void
  onReorderSections?: (orderedTypes: { typeName: string; order: number }[]) => void
  onRenameSection?: (typeName: string, label: string) => void
  onToggleTypeVisibility?: (typeName: string) => void
  onSelectFavorite?: (entry: VaultEntry) => void
  onReorderFavorites?: (orderedPaths: string[]) => void
  views?: ViewFile[]
  onCreateView?: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
  folders?: FolderNode[]
  onCreateFolder?: (name: string) => void
  showInbox?: boolean
  inboxCount?: number
  onCollapse?: () => void
}

export const Sidebar = memo(function Sidebar({
  entries,
  selection,
  onSelect,
  onCustomizeType,
  onUpdateTypeTemplate,
  onReorderSections,
  onRenameSection,
  onToggleTypeVisibility,
  onSelectFavorite,
  onReorderFavorites,
  views = [],
  onCreateView,
  onEditView,
  onDeleteView,
  folders = [],
  onCreateFolder,
  showInbox = true,
  inboxCount = 0,
  onCollapse,
  onCreateNewType,
}: SidebarProps) {
  const [customizeTarget, setCustomizeTarget] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuType, setContextMenuType] = useState<string | null>(null)
  const [renamingType, setRenamingType] = useState<string | null>(null)
  const [renameInitialValue, setRenameInitialValue] = useState('')
  const [showCustomize, setShowCustomize] = useState(false)

  const contextMenuRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const customizeRef = useRef<HTMLDivElement>(null)

  const { typeEntryMap, allSectionGroups, visibleSections, sectionIds } = useSidebarSections(entries)
  const { activeCount, archivedCount } = useEntryCounts(entries)
  const { collapsed: groupCollapsed, toggle: toggleGroup } = useSidebarCollapsed()

  const isSectionVisible = useCallback((type: string) => typeEntryMap[type]?.visible !== false, [typeEntryMap])
  const toggleVisibility = useCallback((type: string) => onToggleTypeVisibility?.(type), [onToggleTypeVisibility])

  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null)
    setContextMenuType(null)
  }, [])
  const closeCustomize = useCallback(() => setShowCustomize(false), [])
  const closeCustomizeTarget = useCallback(() => setCustomizeTarget(null), [])

  useOutsideClick(customizeRef, showCustomize, closeCustomize)
  useOutsideClick(contextMenuRef, !!contextMenuPos, closeContextMenu)
  useOutsideClick(popoverRef, !!customizeTarget, closeCustomizeTarget)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const reordered = computeReorder(sectionIds, active.id as string, over.id as string)
    if (reordered) onReorderSections?.(reordered.map((typeName, order) => ({ typeName, order })))
  }, [sectionIds, onReorderSections])

  const handleContextMenu = useCallback((event: React.MouseEvent, type: string) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
    setContextMenuType(type)
  }, [])

  const cancelRename = useCallback(() => setRenamingType(null), [])

  const handleStartRename = useCallback((type: string) => {
    closeContextMenu()
    const group = allSectionGroups.find((sectionGroup) => sectionGroup.type === type)
    setRenameInitialValue(group?.label ?? type)
    setRenamingType(type)
  }, [allSectionGroups, closeContextMenu])

  const handleRenameSubmit = useCallback((value: string) => {
    if (renamingType) onRenameSection?.(renamingType, value)
    setRenamingType(null)
  }, [renamingType, onRenameSection])

  const handleCustomize = useCallback((prop: 'icon' | 'color', value: string) => {
    applyCustomization(customizeTarget, typeEntryMap, onCustomizeType, prop, value)
  }, [customizeTarget, typeEntryMap, onCustomizeType])

  const handleChangeTemplate = useCallback((template: string) => {
    if (customizeTarget) onUpdateTypeTemplate?.(customizeTarget, template)
  }, [customizeTarget, onUpdateTypeTemplate])

  const sectionProps: SidebarSectionProps = {
    entries,
    selection,
    onSelect,
    onContextMenu: handleContextMenu,
    renamingType,
    renameInitialValue,
    onRenameSubmit: handleRenameSubmit,
    onRenameCancel: cancelRename,
  }

  const hasFavorites = entries.some((entry) => entry.favorite && !entry.archived)
  const hasViews = views.length > 0 || !!onCreateView

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-sidebar text-sidebar-foreground">
      <SidebarTitleBar onCollapse={onCollapse} />
      <nav className="flex-1 overflow-y-auto">
        <SidebarTopNav
          selection={selection}
          onSelect={onSelect}
          showInbox={showInbox}
          inboxCount={inboxCount}
          activeCount={activeCount}
          archivedCount={archivedCount}
        />
        {hasFavorites && (
          <div className="border-b border-border">
            <FavoritesSection
              entries={entries}
              selection={selection}
              onSelect={onSelect}
              onSelectNote={onSelectFavorite}
              onReorder={onReorderFavorites}
              collapsed={groupCollapsed.favorites}
              onToggle={() => toggleGroup('favorites')}
            />
          </div>
        )}
        {hasViews && (
          <ViewsSection
            views={views}
            selection={selection}
            onSelect={onSelect}
            collapsed={groupCollapsed.views}
            onToggle={() => toggleGroup('views')}
            onCreateView={onCreateView}
            onEditView={onEditView}
            onDeleteView={onDeleteView}
            entries={entries}
          />
        )}
        <TypesSection
          visibleSections={visibleSections}
          allSectionGroups={allSectionGroups}
          sectionIds={sectionIds}
          sensors={sensors}
          handleDragEnd={handleDragEnd}
          sectionProps={sectionProps}
          collapsed={groupCollapsed.sections}
          onToggle={() => toggleGroup('sections')}
          showCustomize={showCustomize}
          setShowCustomize={setShowCustomize}
          isSectionVisible={isSectionVisible}
          toggleVisibility={toggleVisibility}
          onCreateNewType={onCreateNewType}
          customizeRef={customizeRef}
        />
        <FolderTree
          folders={folders}
          selection={selection}
          onSelect={onSelect}
          onCreateFolder={onCreateFolder}
          collapsed={groupCollapsed.folders}
          onToggle={() => toggleGroup('folders')}
        />
      </nav>
      <ContextMenuOverlay
        pos={contextMenuPos}
        type={contextMenuType}
        innerRef={contextMenuRef}
        onOpenCustomize={(type) => {
          closeContextMenu()
          setCustomizeTarget(type)
        }}
        onStartRename={handleStartRename}
      />
      <CustomizeOverlay
        target={customizeTarget}
        typeEntryMap={typeEntryMap}
        innerRef={popoverRef}
        onCustomize={handleCustomize}
        onChangeTemplate={handleChangeTemplate}
        onClose={closeCustomizeTarget}
      />
    </aside>
  )
})
