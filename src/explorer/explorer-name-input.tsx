import { useSidebarInlineRenameInput } from '@/shell/sidebar-hooks'
import { stripBlockedNameCharacters, type ExplorerRowKind } from '@/folder/explorer-names'
import { EXPLORER_ROW_ICONS, explorerNameIndent, explorerRowIndent } from './explorer-row'

/**
 * The in-row inline input behind creation and Rename…; it edits the stem
 * only: the extension beside it is dim static text and is never editable, so
 * a Document cannot be renamed out of the tree. `/` never makes it in;
 * everything else the filesystem refuses is reported on commit, as a red
 * hairline ring and one muted line under the row.
 *
 * Enter commits, Escape cancels, and blur commits a changed name — the carried
 * inline-rename hook holds the Enter/blur double-fire guard.
 */

interface ExplorerNameInputProps {
  stem: string
  extension: string
  kind: ExplorerRowKind
  depth: number
  /** The inline message under the row, or null while the name is fine. */
  error: string | null
  onSubmit: (stem: string) => Promise<boolean>
  onCancel: () => void
}

export function ExplorerNameInput(props: ExplorerNameInputProps) {
  const { stem, extension, kind, depth, error, onSubmit, onCancel } = props
  const Icon = EXPLORER_ROW_ICONS[kind]
  const { handleKeyDown, inputRef, setValue, submitValue, value } = useSidebarInlineRenameInput({
    initialValue: stem,
    onCancel,
    onSubmit,
  })

  return (
    <div className="fuwa-explorer__rename">
      <div className="fuwa-sidebar-row fuwa-explorer__row" style={{ paddingLeft: explorerRowIndent(depth) }}>
        <span className="fuwa-explorer__disclosure" />
        <Icon size={14} className="fuwa-sidebar-row__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="fuwa-explorer__rename-input"
          data-testid="explorer-rename-input"
          aria-label="Name"
          aria-invalid={error ? true : undefined}
          data-invalid={error ? true : undefined}
          value={value}
          onChange={(event) => setValue(stripBlockedNameCharacters(event.target.value))}
          onBlur={() => { void submitValue() }}
          onKeyDown={handleKeyDown}
        />
        {extension && <span className="fuwa-explorer__rename-extension">{extension}</span>}
      </div>
      {error && (
        <div
          className="fuwa-explorer__rename-error"
          role="alert"
          data-testid="explorer-rename-error"
          style={{ paddingLeft: explorerNameIndent(depth) }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
