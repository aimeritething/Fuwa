import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AiPanel } from './AiPanel'
import type { VaultEntry } from '../types'

// Mock the hooks and utils to isolate component tests
let mockMessages: ReturnType<typeof import('../hooks/useAiAgent').useAiAgent>['messages'] = []
let mockStatus: ReturnType<typeof import('../hooks/useAiAgent').useAiAgent>['status'] = 'idle'
vi.mock('../hooks/useAiAgent', () => ({
  useAiAgent: () => ({
    messages: mockMessages,
    status: mockStatus,
    sendMessage: vi.fn(),
    clearConversation: vi.fn(),
  }),
}))

vi.mock('../utils/ai-chat', () => ({
  nextMessageId: () => `msg-${Date.now()}`,
}))

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
  trashed: false,
  trashedAt: null,
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

describe('AiPanel', () => {
  beforeEach(() => {
    mockMessages = []
    mockStatus = 'idle'
  })

  it('renders panel with AI Chat header', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByText('AI Chat')).toBeTruthy()
  })

  it('renders data-testid ai-panel', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByTestId('ai-panel')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    const panel = screen.getByTestId('ai-panel')
    const buttons = panel.querySelectorAll('button')
    const closeBtn = Array.from(buttons).find(b => b.title?.includes('Close'))
    expect(closeBtn).toBeTruthy()
    fireEvent.click(closeBtn!)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders empty state without context', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByText('Open a note, then ask the AI about it')).toBeTruthy()
  })

  it('renders contextual empty state when active entry is provided', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} />
    )
    expect(screen.getByText('Ask about this note and its linked context')).toBeTruthy()
  })

  it('shows context bar with active entry title', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} />
    )
    expect(screen.getByTestId('context-bar')).toBeTruthy()
    expect(screen.getByText('My Note')).toBeTruthy()
  })

  it('shows linked count in context bar when entry has outgoing links', () => {
    const linked = makeEntry({ path: '/vault/linked.md', title: 'Linked Note' })
    const entry = makeEntry({ title: 'My Note', outgoingLinks: ['Linked Note'] })
    render(
      <AiPanel
        onClose={vi.fn()} vaultPath="/tmp/vault"
        activeEntry={entry} entries={[entry, linked]}
             />
    )
    expect(screen.getByText('+ 1 linked')).toBeTruthy()
  })

  it('does not show context bar when no active entry', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.queryByTestId('context-bar')).toBeNull()
  })

  it('renders input field enabled', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const input = screen.getByTestId('agent-input')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).disabled).toBe(false)
  })

  it('has send button disabled when input is empty', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const sendBtn = screen.getByTestId('agent-send')
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows contextual placeholder when active entry exists', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} />
    )
    const input = screen.getByTestId('agent-input') as HTMLInputElement
    expect(input.placeholder).toBe('Ask about this note...')
  })

  it('shows generic placeholder when no active entry', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const input = screen.getByTestId('agent-input') as HTMLInputElement
    expect(input.placeholder).toBe('Ask the AI agent...')
  })

  it('auto-focuses input on mount', async () => {
    vi.useFakeTimers()
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    await act(() => { vi.advanceTimersByTime(1) })
    const input = screen.getByTestId('agent-input')
    expect(document.activeElement).toBe(input)
    vi.useRealTimers()
  })

  it('calls onClose when Escape is pressed while panel has focus', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    await act(() => { vi.advanceTimersByTime(1) })
    // Input is focused inside the panel, so Escape should trigger onClose
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when Escape is pressed on panel element', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    const panel = screen.getByTestId('ai-panel')
    panel.focus()
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking a wikilink in AI response calls onOpenNote with the target', () => {
    mockMessages = [{
      userMessage: 'Tell me about notes',
      actions: [],
      response: 'Check out [[Build Laputa App]] for details.',
      id: 'msg-1',
    }]
    const onOpenNote = vi.fn()
    const { container } = render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" onOpenNote={onOpenNote} />,
    )
    const wikilink = container.querySelector('.chat-wikilink')
    expect(wikilink).toBeTruthy()
    expect(wikilink!.textContent).toBe('Build Laputa App')
    fireEvent.click(wikilink!)
    expect(onOpenNote).toHaveBeenCalledWith('Build Laputa App')
  })

  it('renders wikilinks with special characters and clicking works', () => {
    mockMessages = [{
      userMessage: 'Tell me about meetings',
      actions: [],
      response: 'See [[Meeting — 2024/01/15]] and [[Pasta Carbonara]].',
      id: 'msg-2',
    }]
    const onOpenNote = vi.fn()
    const { container } = render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" onOpenNote={onOpenNote} />,
    )
    const wikilinks = container.querySelectorAll('.chat-wikilink')
    expect(wikilinks).toHaveLength(2)
    fireEvent.click(wikilinks[0])
    expect(onOpenNote).toHaveBeenCalledWith('Meeting — 2024/01/15')
    fireEvent.click(wikilinks[1])
    expect(onOpenNote).toHaveBeenCalledWith('Pasta Carbonara')
  })
})
