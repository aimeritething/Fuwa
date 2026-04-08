import { BulkActionBar } from '../BulkActionBar'
import { FilterPills } from './FilterPills'
import { NoteListHeader } from './NoteListHeader'
import { EntityView, ListView } from './NoteListViews'
import type { useNoteListModel } from './useNoteListModel'

type NoteListLayoutProps = ReturnType<typeof useNoteListModel>

export function NoteListLayout({
  title,
  typeDocument,
  isEntityView,
  listSort,
  listDirection,
  customProperties,
  sidebarCollapsed,
  searchVisible,
  search,
  propertyPicker,
  handleSortChange,
  handleCreateNote,
  onOpenType,
  toggleSearch,
  setSearch,
  handleListKeyDown,
  noteListKeyboard,
  entitySelection,
  searchedGroups,
  collapsedGroups,
  sortPrefs,
  toggleGroup,
  renderItem,
  typeEntryMap,
  handleClickNote,
  isArchivedView,
  isChangesView,
  isInboxView,
  modifiedFilesError,
  searched,
  query,
  showFilterPills,
  noteListFilter,
  filterCounts,
  onNoteListFilterChange,
  multiSelect,
  handleBulkArchive,
  handleBulkDeletePermanently,
  handleBulkUnarchive,
  contextMenuNode,
  dialogNode,
}: NoteListLayoutProps) {
  return (
    <div
      className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground"
      style={{ height: '100%' }}
    >
      <NoteListHeader
        title={title}
        typeDocument={typeDocument}
        isEntityView={isEntityView}
        listSort={listSort}
        listDirection={listDirection}
        customProperties={customProperties}
        sidebarCollapsed={sidebarCollapsed}
        searchVisible={searchVisible}
        search={search}
        propertyPicker={propertyPicker}
        onSortChange={handleSortChange}
        onCreateNote={handleCreateNote}
        onOpenType={onOpenType}
        onToggleSearch={toggleSearch}
        onSearchChange={setSearch}
      />
      <div
        className="relative flex flex-1 flex-col overflow-hidden outline-none"
        style={{ minHeight: 0 }}
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onFocus={noteListKeyboard.handleFocus}
        data-testid="note-list-container"
      >
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {entitySelection ? (
            <EntityView
              entity={entitySelection.entry}
              groups={searchedGroups}
              query={query}
              collapsedGroups={collapsedGroups}
              sortPrefs={sortPrefs}
              onToggleGroup={toggleGroup}
              onSortChange={handleSortChange}
              renderItem={renderItem}
              typeEntryMap={typeEntryMap}
              onClickNote={handleClickNote}
            />
          ) : (
            <ListView
              isArchivedView={isArchivedView}
              isChangesView={isChangesView}
              isInboxView={isInboxView}
              changesError={modifiedFilesError}
              searched={searched}
              query={query}
              renderItem={renderItem}
              virtuosoRef={noteListKeyboard.virtuosoRef}
            />
          )}
        </div>
        {showFilterPills && (
          <FilterPills
            active={noteListFilter}
            counts={filterCounts}
            onChange={onNoteListFilterChange}
            position="bottom"
          />
        )}
      </div>
      {multiSelect.isMultiSelecting && (
        <BulkActionBar
          count={multiSelect.selectedPaths.size}
          isArchivedView={isArchivedView}
          onArchive={handleBulkArchive}
          onDelete={handleBulkDeletePermanently}
          onUnarchive={handleBulkUnarchive}
          onClear={multiSelect.clear}
        />
      )}
      {contextMenuNode}
      {dialogNode}
    </div>
  )
}
