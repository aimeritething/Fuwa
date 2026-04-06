import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { WikilinkChatInput } from './WikilinkChatInput'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  ...overrides,
})

const entries: VaultEntry[] = [
  makeEntry({ path: '/vault/alpha.md', title: 'Alpha', filename: 'alpha.md', isA: 'Project' }),
  makeEntry({ path: '/vault/beta.md', title: 'Beta', filename: 'beta.md', isA: 'Person' }),
  makeEntry({ path: '/vault/gamma.md', title: 'Gamma', filename: 'gamma.md' }),
  makeEntry({ path: '/vault/archived.md', title: 'Archived', filename: 'archived.md', archived: true }),
]

/** Wrapper that manages controlled value state so onChange/selectSuggestion work correctly. */
function Controlled({ onSend, ...props }: {
  entries: VaultEntry[]
  onSend?: (text: string, refs: Array<{ title: string; path: string; type: string | null }>) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState('')
  return (
    <WikilinkChatInput
      entries={props.entries}
      value={value}
      onChange={setValue}
      onSend={onSend ?? vi.fn()}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  )
}

/** Helper: type in the input and wait for debounce to flush. */
async function typeAndWait(text: string) {
  fireEvent.change(screen.getByTestId('agent-input'), {
    target: { value: text, selectionStart: text.length },
  })
  await act(() => { vi.advanceTimersByTime(150) })
}

describe('WikilinkChatInput', () => {
  it('renders input with placeholder', () => {
    render(<Controlled entries={entries} placeholder="Ask something..." />)
    const input = screen.getByTestId('agent-input') as HTMLInputElement
    expect(input.placeholder).toBe('Ask something...')
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(
      <WikilinkChatInput entries={entries} value="" onChange={onChange} onSend={vi.fn()} />,
    )
    fireEvent.change(screen.getByTestId('agent-input'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('shows wikilink menu when [[ is typed', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[a')
    expect(screen.getByTestId('wikilink-menu')).toBeTruthy()
    vi.useRealTimers()
  })

  it('filters suggestions matching query', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[alp')
    const menu = screen.getByTestId('wikilink-menu')
    expect(menu.textContent).toContain('Alpha')
    expect(menu.textContent).not.toContain('Beta')
    vi.useRealTimers()
  })

  it('excludes archived entries from suggestions', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[arch')
    const menu = screen.queryByTestId('wikilink-menu')
    if (menu) {
      expect(menu.textContent).not.toContain('Archived')
    }
    vi.useRealTimers()
  })

  it('selects suggestion on click and creates pill', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[a')

    const menu = screen.getByTestId('wikilink-menu')
    const items = menu.querySelectorAll('[class*="cursor-pointer"]')
    expect(items.length).toBeGreaterThan(0)
    fireEvent.click(items[0])

    const pills = screen.queryAllByTestId('reference-pill')
    expect(pills.length).toBe(1)
    vi.useRealTimers()
  })

  it('does not duplicate pills for same note', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)

    // First selection
    await typeAndWait('[[alp')
    fireEvent.click(screen.getByTestId('wikilink-menu').querySelectorAll('[class*="cursor-pointer"]')[0])
    expect(screen.queryAllByTestId('reference-pill').length).toBe(1)

    // Second selection of same note
    await typeAndWait('[[alp')
    fireEvent.click(screen.getByTestId('wikilink-menu').querySelectorAll('[class*="cursor-pointer"]')[0])
    expect(screen.queryAllByTestId('reference-pill').length).toBe(1) // No duplicate
    vi.useRealTimers()
  })

  it('removes pill when x button is clicked', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)

    await typeAndWait('[[alp')
    fireEvent.click(screen.getByTestId('wikilink-menu').querySelectorAll('[class*="cursor-pointer"]')[0])
    expect(screen.queryAllByTestId('reference-pill').length).toBe(1)

    const pill = screen.getByTestId('reference-pill')
    fireEvent.click(pill.querySelector('button')!)
    expect(screen.queryAllByTestId('reference-pill').length).toBe(0)
    vi.useRealTimers()
  })

  it('navigates suggestions with keyboard', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[a')

    const input = screen.getByTestId('agent-input')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // Escape closes menu
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('wikilink-menu')).toBeNull()
    vi.useRealTimers()
  })

  it('selects suggestion with Enter key', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[alp')
    expect(screen.getByTestId('wikilink-menu')).toBeTruthy()

    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })
    expect(screen.queryAllByTestId('reference-pill').length).toBe(1)
    vi.useRealTimers()
  })

  it('calls onSend with text and references on Enter without menu', async () => {
    vi.useFakeTimers()
    const onSend = vi.fn()
    render(<Controlled entries={entries} onSend={onSend} />)

    // Type non-wikilink text
    fireEvent.change(screen.getByTestId('agent-input'), {
      target: { value: 'hello', selectionStart: 5 },
    })
    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello', [])
    vi.useRealTimers()
  })

  it('does not send on Enter+Shift', () => {
    const onSend = vi.fn()
    render(
      <WikilinkChatInput entries={entries} value="hello" onChange={vi.fn()} onSend={onSend} />,
    )
    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send on Enter when input is empty', () => {
    const onSend = vi.fn()
    render(
      <WikilinkChatInput entries={entries} value="" onChange={vi.fn()} onSend={onSend} />,
    )
    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables input when disabled prop is true', () => {
    render(<Controlled entries={entries} disabled />)
    expect((screen.getByTestId('agent-input') as HTMLInputElement).disabled).toBe(true)
  })

  it('closes menu when ]] is typed', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[alp')
    expect(screen.getByTestId('wikilink-menu')).toBeTruthy()

    // Type ]] to close
    fireEvent.change(screen.getByTestId('agent-input'), {
      target: { value: '[[alp]]', selectionStart: 7 },
    })
    expect(screen.queryByTestId('wikilink-menu')).toBeNull()
    vi.useRealTimers()
  })

  it('shows type badge for non-Note types in suggestions', async () => {
    vi.useFakeTimers()
    render(<Controlled entries={entries} />)
    await typeAndWait('[[alp')
    const menu = screen.getByTestId('wikilink-menu')
    expect(menu.textContent).toContain('Project')
    vi.useRealTimers()
  })

  it('matches by alias', async () => {
    vi.useFakeTimers()
    const entriesWithAlias = [
      ...entries,
      makeEntry({ path: '/vault/delta.md', title: 'Delta', filename: 'delta.md', aliases: ['DLT'] }),
    ]
    render(<Controlled entries={entriesWithAlias} />)
    await typeAndWait('[[DLT')
    const menu = screen.getByTestId('wikilink-menu')
    expect(menu.textContent).toContain('Delta')
    vi.useRealTimers()
  })

  it('sends references with onSend after selecting pills', async () => {
    vi.useFakeTimers()
    const onSend = vi.fn()
    render(<Controlled entries={entries} onSend={onSend} />)

    // Select a pill first
    await typeAndWait('[[alp')
    fireEvent.click(screen.getByTestId('wikilink-menu').querySelectorAll('[class*="cursor-pointer"]')[0])
    expect(screen.queryAllByTestId('reference-pill').length).toBe(1)

    // Type a message and send
    fireEvent.change(screen.getByTestId('agent-input'), {
      target: { value: 'tell me about it', selectionStart: 16 },
    })
    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })

    expect(onSend).toHaveBeenCalledOnce()
    const [text, refs] = onSend.mock.calls[0]
    expect(text).toBe('tell me about it')
    expect(refs).toHaveLength(1)
    expect(refs[0].title).toBe('Alpha')
    expect(refs[0].path).toBe('/vault/alpha.md')
    vi.useRealTimers()
  })
})
