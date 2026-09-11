import { Command as CommandIcon, FileText, Image as ImageIcon, type Icon } from '@phosphor-icons/react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  matchCommandMenu,
  type CommandMenuEntry,
  type CommandMenuEntryKind,
  type CommandMenuMatch,
  type CommandMenuMode,
  type CommandMenuRange,
} from '../utils/commandMenuMatcher'
import './CommandMenu.css'

export interface CommandMenuProps {
  open: boolean
  /** ⌘K shows commands, and files once the user types; ⌘P (Quick Open) shows files only. */
  mode: CommandMenuMode
  /** Every row the palette can show: the menu-bar commands and the Folder's files. */
  entries: readonly CommandMenuEntry[]
  onClose: () => void
  onRunCommand: (commandId: string) => void
  /** ↵ opens; ⌘↵ asks for Raw, which only a Document honours. */
  onOpenFile: (path: string, options: { raw: boolean }) => void
}

const ROW_ICONS: Record<CommandMenuEntryKind, Icon> = {
  command: CommandIcon,
  document: FileText,
  image: ImageIcon,
}

const TYPE_LABELS: Record<CommandMenuEntryKind, string> = {
  command: 'Command',
  document: 'Document',
  image: 'Image',
}

const PLACEHOLDERS: Record<CommandMenuMode, string> = {
  commands: 'Search commands and files…',
  files: 'Search files by name…',
}

const TITLES: Record<CommandMenuMode, string> = {
  commands: 'Command Menu',
  files: 'Quick Open',
}

const FOOTER = '↵ open · ⌘↵ open in Raw · esc close'
const LIST_ID = 'fuwa-command-menu-list'

function rowId(index: number): string {
  return `fuwa-command-menu-row-${index}`
}

/** The name with the matched characters emphasised. */
function emphasised(name: string, ranges: readonly CommandMenuRange[]): ReactNode[] {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(name.slice(cursor, start))
    parts.push(<mark key={start}>{name.slice(start, end)}</mark>)
    cursor = end
  }
  if (cursor < name.length) parts.push(name.slice(cursor))
  return parts
}

function wrap(index: number, length: number): number {
  return (index + length) % length
}

function isEnabled(entry: CommandMenuEntry): boolean {
  return entry.enabled !== false
}

interface CommandMenuRowProps {
  match: CommandMenuMatch
  index: number
  active: boolean
  onHover: (index: number) => void
  onPick: (entry: CommandMenuEntry, event: MouseEvent) => void
}

function CommandMenuRow({ match, index, active, onHover, onPick }: CommandMenuRowProps) {
  const { entry, ranges } = match
  const RowIcon = ROW_ICONS[entry.kind]
  const enabled = isEnabled(entry)
  return (
    <li
      id={rowId(index)}
      role="option"
      aria-selected={active}
      aria-disabled={enabled ? undefined : true}
      className="fuwa-command-menu__row"
      data-testid="command-menu-row"
      data-kind={entry.kind}
      data-id={entry.id}
      data-active={active || undefined}
      onMouseMove={() => onHover(index)}
      onClick={(event) => onPick(entry, event)}
    >
      <RowIcon size={16} className="fuwa-command-menu__icon" aria-hidden="true" />
      <span className="fuwa-command-menu__name" data-testid="command-menu-row-name">{emphasised(entry.name, ranges)}</span>
      {entry.detail && (
        <span className="fuwa-command-menu__detail" data-testid="command-menu-row-detail">{entry.detail}</span>
      )}
      {entry.shortcut && (
        <span className="fuwa-command-menu__shortcut" data-testid="command-menu-row-shortcut">{entry.shortcut}</span>
      )}
      <span className="fuwa-command-menu__type" data-testid="command-menu-row-type">{TYPE_LABELS[entry.kind]}</span>
    </li>
  )
}

type CommandMenuPanelProps = Omit<CommandMenuProps, 'open' | 'onClose'>

/**
 * The palette's body. Mounted only while open, so the query and the selection
 * start fresh every time; a mode switch while open keeps the query.
 */
function CommandMenuPanel({ mode, entries, onRunCommand, onOpenFile }: CommandMenuPanelProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLUListElement | null>(null)
  const matches = useMemo(() => matchCommandMenu(entries, query, mode), [entries, mode, query])
  const activeIndex = matches.length === 0 ? -1 : Math.min(selectedIndex, matches.length - 1)

  useEffect(() => {
    if (activeIndex < 0) return
    const row = listRef.current?.querySelector<HTMLElement>(`#${rowId(activeIndex)}`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const pick = (entry: CommandMenuEntry, raw: boolean) => {
    if (entry.kind === 'command') {
      if (isEnabled(entry)) onRunCommand(entry.id)
      return
    }
    onOpenFile(entry.id, { raw: raw && entry.kind === 'document' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (matches.length === 0) return
      setSelectedIndex(wrap(activeIndex + (event.key === 'ArrowDown' ? 1 : -1), matches.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const match = matches[activeIndex]
      if (match) pick(match.entry, event.metaKey)
    }
  }

  return (
    <>
      <DialogPrimitive.Title className="sr-only">{TITLES[mode]}</DialogPrimitive.Title>
      <input
        className="fuwa-command-menu__input"
        data-testid="command-menu-input"
        role="combobox"
        aria-expanded="true"
        aria-controls={LIST_ID}
        aria-activedescendant={activeIndex >= 0 ? rowId(activeIndex) : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={PLACEHOLDERS[mode]}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setSelectedIndex(0)
        }}
        onKeyDown={onKeyDown}
      />
      <ul id={LIST_ID} ref={listRef} role="listbox" aria-label={TITLES[mode]} className="fuwa-command-menu__list">
        {matches.length === 0 && (
          <li className="fuwa-command-menu__empty" data-testid="command-menu-empty" aria-disabled="true">No matches</li>
        )}
        {matches.map((match, index) => (
          <CommandMenuRow
            key={`${match.entry.kind}:${match.entry.id}`}
            match={match}
            index={index}
            active={index === activeIndex}
            onHover={setSelectedIndex}
            onPick={(entry, event) => pick(entry, event.metaKey)}
          />
        ))}
      </ul>
      <footer className="fuwa-command-menu__footer" data-testid="command-menu-footer">{FOOTER}</footer>
    </>
  )
}

/**
 * The Command Menu and Quick Open (spec sections 2 and 7): one palette, two
 * modes, over the whole window. Radix's dialog gives it the backdrop, the
 * focus trap and esc; the rows and the matcher are Fuwa's own. New Fuwa code
 * on the shared command manifest; Tolaria's palette is not ported.
 */
export function CommandMenu({ open, mode, entries, onClose, onRunCommand, onOpenFile }: CommandMenuProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fuwa-command-menu__backdrop" />
        <DialogPrimitive.Content
          className="fuwa-command-menu"
          data-testid="command-menu"
          data-mode={mode}
          data-command-palette="true"
          aria-describedby={undefined}
        >
          <CommandMenuPanel mode={mode} entries={entries} onRunCommand={onRunCommand} onOpenFile={onOpenFile} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
