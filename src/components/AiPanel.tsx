import { useEffect, useRef } from 'react'
import { Robot, X, PaperPlaneRight, Plus, Link } from '@phosphor-icons/react'
import { AiMessage } from './AiMessage'
import { WikilinkChatInput } from './WikilinkChatInput'
import { type AiAgentMessage } from '../hooks/useAiAgent'
import { type NoteReference, type NoteListItem } from '../utils/ai-context'
import type { VaultEntry } from '../types'
import { extractInlineWikilinkReferences } from './inlineWikilinkText'
import { useAiPanelController } from './useAiPanelController'
import { useAiPanelPromptQueue } from './useAiPanelPromptQueue'
import { useAiPanelFocus } from './useAiPanelFocus'

export type { AiAgentMessage } from '../hooks/useAiAgent'

interface AiPanelProps {
  onClose: () => void
  onOpenNote?: (path: string) => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
  vaultPath: string
  activeEntry?: VaultEntry | null
  /** Direct content of the active note from the editor tab. */
  activeNoteContent?: string | null
  entries?: VaultEntry[]
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
}

function PanelHeader({ onClose, onClear }: { onClose: () => void; onClear: () => void }) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border"
      style={{ height: 52, padding: '0 12px', gap: 8 }}
    >
      <Robot size={16} className="shrink-0 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
        AI Chat
      </span>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClear}
        title="New conversation"
      >
        <Plus size={16} />
      </button>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClose}
        title="Close AI panel"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function ContextBar({ activeEntry, linkedCount }: { activeEntry: VaultEntry; linkedCount: number }) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border text-muted-foreground"
      style={{ padding: '6px 12px', gap: 6, fontSize: 11 }}
      data-testid="context-bar"
    >
      <Link size={12} className="shrink-0" />
      <span className="truncate" style={{ fontWeight: 500 }}>{activeEntry.title}</span>
      {linkedCount > 0 && (
        <span style={{ opacity: 0.6 }}>+ {linkedCount} linked</span>
      )}
    </div>
  )
}

function EmptyState({ hasContext }: { hasContext: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center text-muted-foreground"
      style={{ paddingTop: 40 }}
    >
      <Robot size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
      <p style={{ fontSize: 13, margin: '0 0 4px' }}>
        {hasContext
          ? 'Ask about this note and its linked context'
          : 'Open a note, then ask the AI about it'
        }
      </p>
      <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
        {hasContext
          ? 'Summarize, find connections, expand ideas'
          : 'The AI will use the active note as context'
        }
      </p>
    </div>
  )
}

function MessageHistory({ messages, isActive, onOpenNote, onNavigateWikilink, hasContext }: {
  messages: AiAgentMessage[]; isActive: boolean; onOpenNote?: (path: string) => void; onNavigateWikilink?: (target: string) => void; hasContext: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isActive])

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
      {messages.length === 0 && !isActive && <EmptyState hasContext={hasContext} />}
      {messages.map((msg, i) => (
        <AiMessage key={msg.id ?? i} {...msg} onOpenNote={onOpenNote} onNavigateWikilink={onNavigateWikilink} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function AiPanelComposer({
  entries,
  hasContext,
  input,
  inputRef,
  isActive,
  onChange,
  onSend,
}: {
  entries: VaultEntry[]
  hasContext: boolean
  input: string
  inputRef: React.RefObject<HTMLDivElement | null>
  isActive: boolean
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
}) {
  return (
    <div
      className="flex shrink-0 flex-col border-t border-border"
      style={{ padding: '8px 12px' }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <WikilinkChatInput
            entries={entries}
            value={input}
            onChange={onChange}
            onSend={onSend}
            disabled={isActive}
            placeholder={hasContext ? 'Ask about this note...' : 'Ask the AI agent...'}
            inputRef={inputRef}
          />
        </div>
        <button
          className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors"
          style={{
            background: (isActive || !input.trim()) ? 'var(--muted)' : 'var(--primary)',
            color: (isActive || !input.trim()) ? 'var(--muted-foreground)' : 'white',
            borderRadius: 8, width: 32, height: 34,
            cursor: (isActive || !input.trim()) ? 'not-allowed' : 'pointer',
          }}
          onClick={() => onSend(input, extractInlineWikilinkReferences(input, entries))}
          disabled={isActive || !input.trim()}
          title="Send message"
          data-testid="agent-send"
        >
          <PaperPlaneRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function AiPanel({ onClose, onOpenNote, onFileCreated, onFileModified, onVaultChanged, vaultPath, activeEntry, activeNoteContent, entries, openTabs, noteList, noteListFilter }: AiPanelProps) {
  const inputRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const {
    agent,
    input,
    setInput,
    linkedEntries,
    hasContext,
    isActive,
    handleSend,
    handleNavigateWikilink,
  } = useAiPanelController({
    vaultPath,
    activeEntry,
    activeNoteContent,
    entries,
    openTabs,
    noteList,
    noteListFilter,
    onOpenNote,
    onFileCreated,
    onFileModified,
    onVaultChanged,
  })

  useAiPanelPromptQueue({ agent, input, isActive, setInput })
  useAiPanelFocus({ inputRef, panelRef, isActive, onClose })

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="flex flex-1 flex-col overflow-hidden bg-background text-foreground"
      style={{
        outline: 'none',
        borderLeft: isActive
          ? '2px solid var(--accent-blue, #3b82f6)'
          : '1px solid var(--border)',
        animation: isActive ? 'ai-border-pulse 2s ease-in-out infinite' : undefined,
        transition: 'border-color 0.3s ease',
      }}
      data-testid="ai-panel"
      data-ai-active={isActive || undefined}
    >
      <PanelHeader onClose={onClose} onClear={agent.clearConversation} />
      {activeEntry && (
        <ContextBar activeEntry={activeEntry} linkedCount={linkedEntries.length} />
      )}
      <MessageHistory
        messages={agent.messages}
        isActive={isActive}
        onOpenNote={onOpenNote}
        onNavigateWikilink={handleNavigateWikilink}
        hasContext={hasContext}
      />
      <AiPanelComposer
        entries={entries ?? []}
        hasContext={hasContext}
        input={input}
        inputRef={inputRef}
        isActive={isActive}
        onChange={setInput}
        onSend={handleSend}
      />
    </aside>
  )
}
