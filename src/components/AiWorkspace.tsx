import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Archive,
  ArrowSquareIn,
  ArrowSquareOut,
  ArrowsInLineHorizontal,
  ArrowsOutLineHorizontal,
  CaretDown,
  GearSix,
  Plus,
  SidebarSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useDragRegion } from '../hooks/useDragRegion'
import {
  DEFAULT_AI_AGENT,
  getAiAgentAvailability,
  type AiAgentId,
  type AiAgentReadiness,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import {
  agentTargets,
  aiTargetReady,
  targetAgent,
  type AiModelProvider,
  type AiTarget,
} from '../lib/aiTargets'
import {
  aiAgentPermissionModeLabels,
  type AiAgentPermissionMode,
} from '../lib/aiAgentPermissionMode'
import {
  getVaultAiGuidanceSummary,
  vaultAiGuidanceNeedsRestore,
  type VaultAiGuidanceStatus,
} from '../lib/vaultAiGuidance'
import { translate, type AppLocale } from '../lib/i18n'
import { trackAiWorkspaceChatTitled, trackAiWorkspaceSidebarToggled } from '../lib/productAnalytics'
import type { AgentStatus } from '../hooks/useCliAiAgent'
import type { AiWorkspaceConversationSetting } from '../types'
import type { NoteListItem } from '../utils/ai-context'
import type { VaultEntry } from '../types'
import { NEW_AI_CHAT_EVENT } from '../utils/aiPromptBridge'
import {
  generateAiConversationTitleForTarget,
  type GenerateAiConversationTitleRequest,
} from '../utils/aiConversationTitle'
import { cloneAiWorkspaceSessionUntilMessage } from '../lib/aiWorkspaceSessionStore'
import { AiPanelView } from './AiPanel'
import { AiAgentIcon } from './AiAgentIcon'
import { ConversationSidebar } from './AiWorkspaceSidebar'
import { ResizeHandle } from './ResizeHandle'
import { useAiPanelController } from './useAiPanelController'
import { buildAiWorkspaceTargetGroups, type AiWorkspaceTargetGroups } from './aiWorkspaceTargetGroups'

export interface AiConversation {
  archived: boolean
  hasActivity: boolean
  id: string
  targetId: string
  title: string
  usesDefaultTitle: boolean
  usesDefaultTarget: boolean
}

interface AiWorkspaceProps {
  activeEntry?: VaultEntry | null
  activeNoteContent?: string | null
  aiAgentsStatus: AiAgentsStatus
  aiModelProviders?: AiModelProvider[]
  conversationSettings?: AiWorkspaceConversationSetting[] | null
  conversationSettingsReady?: boolean
  defaultAiAgent?: AiAgentId
  defaultAiAgentReadiness?: AiAgentReadiness
  defaultAiAgentReady?: boolean
  defaultAiTarget?: AiTarget
  entries?: VaultEntry[]
  initialActiveConversationId?: string
  locale?: AppLocale
  mode?: 'docked' | 'side' | 'window'
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  onActiveConversationChange?: (id: string) => void
  onClose: () => void
  onConversationSettingsChange?: (conversations: AiWorkspaceConversationSetting[]) => void
  onDock?: () => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onOpenAiSettings?: () => void
  onOpenNote?: (path: string) => void
  onPopOut?: (context?: { activeConversationId?: string }) => void
  onRestoreVaultAiGuidance?: () => void
  onUnsupportedAiPaste?: (message: string) => void
  onVaultChanged?: () => void
  open: boolean
  openTabs?: VaultEntry[]
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  vaultPath: string
  vaultPaths?: string[]
}

let fallbackConversationIdCounter = 0

const DEFAULT_DOCKED_WORKSPACE_SIZE = { height: 540, width: 560 }
const MIN_DOCKED_WORKSPACE_SIZE = { height: 360, width: 460 }
const DEFAULT_SIDE_WORKSPACE_WIDTH = 320
const MIN_SIDE_WORKSPACE_WIDTH = 320
const SIDE_WORKSPACE_WIDTH_STORAGE_KEY = 'tolaria:ai-workspace-side-width'
const DEFAULT_SIDEBAR_WIDTH = 168
const MIN_SIDEBAR_WIDTH = 132
const MAX_SIDEBAR_WIDTH = 240

function randomConversationIdPart(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID().slice(0, 8)

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const values = new Uint32Array(2)
    cryptoApi.getRandomValues(values)
    return Array.from(values, (value) => value.toString(36)).join('').slice(0, 8)
  }

  fallbackConversationIdCounter += 1
  return fallbackConversationIdCounter.toString(36).padStart(4, '0')
}

function nextConversationId(): string {
  return `ai-chat-${Date.now()}-${randomConversationIdPart()}`
}

function isRunningStatus(status: AgentStatus | undefined): boolean {
  return status === 'thinking' || status === 'tool-executing'
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function maxDockedWorkspaceSize(): { height: number; width: number } {
  if (typeof window === 'undefined') return { height: 680, width: 880 }

  return {
    height: Math.max(MIN_DOCKED_WORKSPACE_SIZE.height, window.innerHeight - 88),
    width: Math.max(MIN_DOCKED_WORKSPACE_SIZE.width, window.innerWidth - 32),
  }
}

function readStoredSideWorkspaceWidth(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_SIDE_WORKSPACE_WIDTH

  try {
    const parsed = Number(localStorage.getItem(SIDE_WORKSPACE_WIDTH_STORAGE_KEY))
    if (!Number.isFinite(parsed)) return DEFAULT_SIDE_WORKSPACE_WIDTH
    return clampNumber(parsed, MIN_SIDE_WORKSPACE_WIDTH, maxDockedWorkspaceSize().width)
  } catch {
    return DEFAULT_SIDE_WORKSPACE_WIDTH
  }
}

function writeStoredSideWorkspaceWidth(width: number): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(SIDE_WORKSPACE_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Ignore unavailable or restricted localStorage implementations.
  }
}

function canArchiveConversation(conversation: AiConversation): boolean {
  return conversation.archived || conversation.hasActivity
}

function agentReadinessForTarget(target: AiTarget, statuses: AiAgentsStatus): AiAgentReadiness {
  if (target.kind === 'api_model') return 'ready'
  const status = getAiAgentAvailability(statuses, target.agent).status
  if (status === 'checking') return 'checking'
  return status === 'installed' ? 'ready' : 'missing'
}

function flatTargets(groups: AiWorkspaceTargetGroups): AiTarget[] {
  return [...groups.localAgents, ...groups.localModels, ...groups.apiModels]
}

function firstTarget(groups: AiWorkspaceTargetGroups, defaultTarget: AiTarget | undefined, defaultAgent: AiAgentId): AiTarget {
  const targets = flatTargets(groups)
  const selectedDefault = defaultTarget ? targets.find((target) => target.id === defaultTarget.id) : undefined
  if (selectedDefault) return selectedDefault

  const selectedAgent = targets.find((target) => target.kind === 'agent' && target.agent === defaultAgent)
  return selectedAgent ?? targets[0] ?? defaultTarget ?? agentTargets()[0]
}

function resolveTarget(conversation: AiConversation, groups: AiWorkspaceTargetGroups, fallback: AiTarget): AiTarget {
  return flatTargets(groups).find((target) => target.id === conversation.targetId) ?? fallback
}

function createConversation(locale: AppLocale, target: AiTarget, index: number): AiConversation {
  return {
    archived: false,
    hasActivity: false,
    id: nextConversationId(),
    targetId: target.id,
    title: translate(locale, 'ai.workspace.chatTitle', { index }),
    usesDefaultTitle: true,
    usesDefaultTarget: true,
  }
}

function isDefaultConversationTitle(title: string): boolean {
  return /^(AI\s+)?Chat\s+\d+$/i.test(title.trim())
}

function conversationFromSetting(setting: AiWorkspaceConversationSetting, fallbackTarget: AiTarget): AiConversation | null {
  const id = setting.id.trim()
  const title = setting.title.trim()
  if (!id || !title) return null

  return {
    archived: setting.archived === true,
    hasActivity: !isDefaultConversationTitle(title),
    id,
    targetId: setting.target_id?.trim() || fallbackTarget.id,
    title,
    usesDefaultTitle: isDefaultConversationTitle(title),
    usesDefaultTarget: !setting.target_id,
  }
}

function conversationsFromSettings(
  settings: AiWorkspaceConversationSetting[] | null | undefined,
  fallbackTarget: AiTarget,
  locale: AppLocale,
): AiConversation[] {
  const stored = (settings ?? [])
    .map((setting) => conversationFromSetting(setting, fallbackTarget))
    .filter((conversation): conversation is AiConversation => conversation !== null)
  return stored.length > 0 ? stored : [createConversation(locale, fallbackTarget, 1)]
}

function conversationsToSettings(conversations: AiConversation[]): AiWorkspaceConversationSetting[] {
  return conversations.map((conversation) => ({
    archived: conversation.archived,
    id: conversation.id,
    target_id: conversation.usesDefaultTarget ? null : conversation.targetId,
    title: conversation.title,
  }))
}

function activeConversationForState(
  conversations: AiConversation[],
  activeId: string,
  showArchived: boolean,
): AiConversation | undefined {
  const selected = conversations.find((conversation) => conversation.id === activeId)
  if (selected && selected.archived === showArchived) return selected

  return conversations.find((conversation) => conversation.archived === showArchived)
    ?? conversations.find((conversation) => !conversation.archived)
    ?? conversations[0]
}

interface UseConversationsOptions {
  fallbackTarget: AiTarget
  initialActiveConversationId?: string
  locale: AppLocale
  onSettingsChange?: (conversations: AiWorkspaceConversationSetting[]) => void
  settings?: AiWorkspaceConversationSetting[] | null
  settingsReady: boolean
}

function appendConversationState(
  current: AiConversation[],
  locale: AppLocale,
  target: AiTarget,
): { activeId: string; conversations: AiConversation[] } {
  const next = createConversation(locale, target, current.length + 1)
  return {
    activeId: next.id,
    conversations: [...current, next],
  }
}

function forkConversationState(
  current: AiConversation[],
  locale: AppLocale,
  sourceId: string,
): { activeId: string; conversations: AiConversation[] } | null {
  const source = current.find((conversation) => conversation.id === sourceId)
  if (!source) return null

  const index = current.length + 1
  const next: AiConversation = {
    archived: false,
    hasActivity: true,
    id: nextConversationId(),
    targetId: source.targetId,
    title: source.usesDefaultTitle ? translate(locale, 'ai.workspace.chatTitle', { index }) : source.title,
    usesDefaultTitle: false,
    usesDefaultTarget: source.usesDefaultTarget,
  }

  return {
    activeId: next.id,
    conversations: [...current, next],
  }
}

function archiveConversationState(
  current: AiConversation[],
  id: string,
): { activeId?: string; conversations: AiConversation[] } {
  const conversations = current.map((conversation) => (
    conversation.id === id ? { ...conversation, archived: true } : conversation
  ))
  const fallback = conversations.find((conversation) => !conversation.archived && conversation.id !== id)
  return { activeId: fallback?.id, conversations }
}

function closeConversationState(
  current: AiConversation[],
  id: string,
  activeId: string,
  fallbackTarget: AiTarget,
  locale: AppLocale,
): { activeId: string; conversations: AiConversation[] } {
  const closedConversation = current.find((conversation) => conversation.id === id)
  if (!closedConversation) return { activeId, conversations: current }

  const conversations = closedConversation.hasActivity
    ? current.map((conversation) => (
        conversation.id === id ? { ...conversation, archived: true } : conversation
      ))
    : current.filter((conversation) => conversation.id !== id)
  const activeConversation = conversations.find((conversation) => conversation.id === activeId && !conversation.archived)
  if (activeConversation) return { activeId, conversations }

  const fallbackConversation = conversations.find((conversation) => !conversation.archived)
  if (fallbackConversation) return { activeId: fallbackConversation.id, conversations }

  const nextConversation = createConversation(locale, fallbackTarget, conversations.length + 1)
  return {
    activeId: nextConversation.id,
    conversations: [...conversations, nextConversation],
  }
}

function restoreConversationState(current: AiConversation[], id: string): AiConversation[] {
  return current.map((conversation) => (
    conversation.id === id ? { ...conversation, archived: false } : conversation
  ))
}

function retargetConversationState(current: AiConversation[], id: string, targetId: string): AiConversation[] {
  return current.map((conversation) => (
    conversation.id === id ? { ...conversation, targetId, usesDefaultTarget: false } : conversation
  ))
}

function reorderConversationState(current: AiConversation[], activeId: string, overId: string): AiConversation[] {
  const oldIndex = current.findIndex((conversation) => conversation.id === activeId)
  const newIndex = current.findIndex((conversation) => conversation.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return current

  return arrayMove(current, oldIndex, newIndex)
}

function renameConversationState(current: AiConversation[], id: string, title: string): AiConversation[] {
  const nextTitle = title.trim()
  if (!nextTitle) return current

  return current.map((conversation) => (
    conversation.id === id ? { ...conversation, title: nextTitle, usesDefaultTitle: false } : conversation
  ))
}

function markConversationActivityState(current: AiConversation[], id: string): AiConversation[] {
  return current.map((conversation) => (
    conversation.id === id
      ? {
          ...conversation,
          hasActivity: true,
        }
      : conversation
  ))
}

function applyGeneratedConversationTitleState(current: AiConversation[], id: string, title: string): AiConversation[] {
  const nextTitle = title.trim()
  if (!nextTitle) return current

  return current.map((conversation) => (
    conversation.id === id && conversation.usesDefaultTitle
      ? { ...conversation, title: nextTitle, usesDefaultTitle: false }
      : conversation
  ))
}

function updateDefaultConversationTargetState(current: AiConversation[], targetId: string): AiConversation[] {
  return current.map((conversation) => (
    conversation.usesDefaultTarget && conversation.targetId !== targetId
      ? { ...conversation, targetId }
      : conversation
  ))
}

function useConversations({
  fallbackTarget,
  initialActiveConversationId,
  locale,
  onSettingsChange,
  settings,
  settingsReady,
}: UseConversationsOptions) {
  const [conversations, setConversations] = useState<AiConversation[]>(() => (
    conversationsFromSettings(settings, fallbackTarget, locale)
  ))
  const [activeId, setActiveId] = useState(() => (
    conversations.some((conversation) => conversation.id === initialActiveConversationId)
      ? initialActiveConversationId ?? ''
      : conversations[0]?.id ?? ''
  ))
  const [showArchived, setShowArchived] = useState(false)
  const onSettingsChangeRef = useRef(onSettingsChange)

  const addConversation = useCallback((target: AiTarget) => {
    const next = appendConversationState(conversations, locale, target)
    setConversations(next.conversations)
    setActiveId(next.activeId)
  }, [conversations, locale])

  const forkConversation = useCallback((sourceId: string) => {
    const next = forkConversationState(conversations, locale, sourceId)
    if (!next) return undefined

    setConversations(next.conversations)
    setActiveId(next.activeId)
    return next.activeId
  }, [conversations, locale])

  const archiveConversation = useCallback((id: string) => {
    const next = archiveConversationState(conversations, id)
    setConversations(next.conversations)
    if (next.activeId) setActiveId(next.activeId)
  }, [conversations])

  const closeConversation = useCallback((id: string) => {
    const next = closeConversationState(conversations, id, activeId, fallbackTarget, locale)
    setConversations(next.conversations)
    setActiveId(next.activeId)
  }, [activeId, conversations, fallbackTarget, locale])

  const restoreConversation = useCallback((id: string) => {
    setConversations((current) => restoreConversationState(current, id))
    setActiveId(id)
    setShowArchived(false)
  }, [])

  const reorderConversation = useCallback((activeId: string, overId: string) => {
    setConversations((current) => reorderConversationState(current, activeId, overId))
  }, [])

  const setConversationTarget = useCallback((id: string, targetId: string) => {
    setConversations((current) => retargetConversationState(current, id, targetId))
  }, [])

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((current) => renameConversationState(current, id, title))
  }, [])

  const titleConversationFromPrompt = useCallback((request: GenerateAiConversationTitleRequest & { id: string }) => {
    setConversations((current) => markConversationActivityState(current, request.id))

    void generateAiConversationTitleForTarget(request).then((title) => {
      if (!title) return
      setConversations((current) => applyGeneratedConversationTitleState(current, request.id, title))
    })
  }, [])

  const updateDefaultConversationTargets = useCallback((targetId: string) => {
    setConversations((current) => updateDefaultConversationTargetState(current, targetId))
  }, [])

  useEffect(() => {
    onSettingsChangeRef.current = onSettingsChange
  }, [onSettingsChange])

  useEffect(() => {
    if (!settingsReady) return
    onSettingsChangeRef.current?.(conversationsToSettings(conversations))
  }, [conversations, settingsReady])

  return {
    activeId,
    addConversation,
    archiveConversation,
    closeConversation,
    conversations,
    forkConversation,
    renameConversation,
    reorderConversation,
    restoreConversation,
    setActiveId,
    setConversationTarget,
    setShowArchived,
    showArchived,
    titleConversationFromPrompt,
    updateDefaultConversationTargets,
  }
}

function TargetGroup({ label, targets }: { label: string; targets: AiTarget[] }) {
  if (targets.length === 0) return null

  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {targets.map((target) => (
        <DropdownMenuRadioItem key={target.id} value={target.id} className="gap-2">
          {target.kind === 'agent' ? <AiAgentIcon agent={target.agent} size={16} /> : null}
          <span className="truncate">{target.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </>
  )
}

function TargetPickerTrigger({
  compact,
  disabled,
  hasTargets,
  locale,
  selectedTarget,
}: {
  compact: boolean
  disabled: boolean
  hasTargets: boolean
  locale: AppLocale
  selectedTarget: AiTarget
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'xs' : 'sm'}
        className={cn(
          'justify-between gap-1.5 text-muted-foreground hover:text-foreground',
          compact ? 'max-w-[150px] rounded-full px-2 text-[12px]' : 'max-w-[240px] gap-2',
        )}
        disabled={disabled || !hasTargets}
        aria-label={translate(locale, 'ai.workspace.targetLabel')}
        data-testid="ai-workspace-target-trigger"
      >
        {selectedTarget.kind === 'agent' ? <AiAgentIcon agent={selectedTarget.agent} size={compact ? 14 : 16} /> : null}
        <span className="truncate">{selectedTarget.shortLabel}</span>
        <CaretDown size={compact ? 12 : 13} />
      </Button>
    </DropdownMenuTrigger>
  )
}

type AiWorkspaceMode = 'docked' | 'side' | 'window'

function TargetPickerContent({
  groups,
  hasTargets,
  locale,
  onSelectTarget,
  selectedTarget,
  side,
}: {
  groups: AiWorkspaceTargetGroups
  hasTargets: boolean
  locale: AppLocale
  selectedTarget: AiTarget
  onSelectTarget: (targetId: string) => void
  side: 'bottom' | 'top'
}) {
  const hasLocalAgentsSeparator = groups.localAgents.length > 0
    && (groups.localModels.length > 0 || groups.apiModels.length > 0)
  const hasLocalModelsSeparator = groups.localModels.length > 0 && groups.apiModels.length > 0

  return (
    <DropdownMenuContent align="start" side={side} className="min-w-[280px]">
      {hasTargets ? (
        <DropdownMenuRadioGroup value={selectedTarget.id} onValueChange={onSelectTarget}>
          <TargetGroup label={translate(locale, 'ai.workspace.targetLocalAgents')} targets={groups.localAgents} />
          {hasLocalAgentsSeparator && <DropdownMenuSeparator />}
          <TargetGroup label={translate(locale, 'ai.workspace.targetLocalModels')} targets={groups.localModels} />
          {hasLocalModelsSeparator && <DropdownMenuSeparator />}
          <TargetGroup label={translate(locale, 'ai.workspace.targetApiModels')} targets={groups.apiModels} />
        </DropdownMenuRadioGroup>
      ) : (
        <DropdownMenuItem disabled>{translate(locale, 'ai.workspace.noTargets')}</DropdownMenuItem>
      )}
    </DropdownMenuContent>
  )
}

function TargetPicker({
  compact = false,
  disabled,
  groups,
  locale,
  selectedTarget,
  side = 'bottom',
  onSelectTarget,
}: {
  compact?: boolean
  disabled: boolean
  groups: AiWorkspaceTargetGroups
  locale: AppLocale
  selectedTarget: AiTarget
  side?: 'bottom' | 'top'
  onSelectTarget: (targetId: string) => void
}) {
  const hasTargets = flatTargets(groups).length > 0

  return (
    <DropdownMenu>
      <TargetPickerTrigger
        compact={compact}
        disabled={disabled}
        hasTargets={hasTargets}
        locale={locale}
        selectedTarget={selectedTarget}
      />
      <TargetPickerContent
        groups={groups}
        hasTargets={hasTargets}
        locale={locale}
        selectedTarget={selectedTarget}
        side={side}
        onSelectTarget={onSelectTarget}
      />
    </DropdownMenu>
  )
}

function PermissionPicker({
  compact = false,
  disabled,
  locale,
  permissionMode,
  side = 'bottom',
  targetKind,
  onChange,
}: {
  compact?: boolean
  disabled: boolean
  locale: AppLocale
  permissionMode: AiAgentPermissionMode
  side?: 'bottom' | 'top'
  targetKind: AiTarget['kind']
  onChange: (mode: AiAgentPermissionMode) => void
}) {
  if (targetKind === 'api_model') {
    return (
      <Button type="button" variant={compact ? 'ghost' : 'outline'} size={compact ? 'xs' : 'sm'} disabled className="rounded-full px-2 text-[12px] text-muted-foreground">
        {translate(locale, 'ai.panel.mode.chat')}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={compact ? 'ghost' : 'outline'}
          size={compact ? 'xs' : 'sm'}
          className={cn(
            'justify-between text-muted-foreground hover:text-foreground',
            compact ? 'rounded-full px-2 text-[12px]' : 'gap-2',
          )}
          disabled={disabled}
          aria-label={translate(locale, 'ai.workspace.permissionMode')}
          data-testid="ai-workspace-permission-trigger"
        >
          {aiAgentPermissionModeLabels(permissionMode, locale).control}
          <CaretDown size={compact ? 12 : 13} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={side} className="min-w-[180px]">
        {(['safe', 'power_user'] as const).map((mode) => (
          <DropdownMenuItem key={mode} onSelect={() => onChange(mode)}>
            {aiAgentPermissionModeLabels(mode, locale).control}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GuidanceWarning({
  locale,
  onRestore,
  status,
}: {
  locale: AppLocale
  onRestore?: () => void
  status?: VaultAiGuidanceStatus
}) {
  if (!status || !vaultAiGuidanceNeedsRestore(status)) return null

  return (
    <div className="flex shrink-0 items-center gap-2 border-y border-border bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
      <WarningCircle size={15} className="shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        {translate(locale, 'ai.workspace.guidanceWarning', { summary: getVaultAiGuidanceSummary(status) })}
      </span>
      {status.canRestore && onRestore && (
        <Button type="button" variant="outline" size="xs" onClick={onRestore}>
          {translate(locale, 'ai.workspace.restoreGuidance')}
        </Button>
      )}
    </div>
  )
}

function WorkspaceHeader({
  conversation,
  archiveDisabled,
  locale,
  mode,
  onArchive,
  onClose,
  onDock,
  onOpenAiSettings,
  onPopOut,
}: {
  conversation: AiConversation
  archiveDisabled: boolean
  locale: AppLocale
  mode: AiWorkspaceMode
  onArchive: () => void
  onClose: () => void
  onDock?: () => void
  onOpenAiSettings?: () => void
  onPopOut?: (context?: { activeConversationId?: string }) => void
}) {
  const { dragRegionRef } = useDragRegion<HTMLDivElement>()

  return (
    <div
      ref={dragRegionRef}
      className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
      data-testid="ai-workspace-chat-header"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 max-w-[260px]">
          <div className="truncate text-[13px] font-semibold text-foreground">{conversation.title}</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onOpenAiSettings && (
          <Button type="button" variant="ghost" size="icon-xs" aria-label={translate(locale, 'ai.workspace.settings')} title={translate(locale, 'ai.workspace.settings')} onClick={onOpenAiSettings}>
            <GearSix size={16} />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-xs" aria-label={translate(locale, 'ai.workspace.archive')} title={translate(locale, 'ai.workspace.archive')} disabled={archiveDisabled} onClick={onArchive}>
          <Archive size={16} />
        </Button>
        {mode === 'docked' ? (
          <Button type="button" variant="ghost" size="icon-xs" aria-label={translate(locale, 'ai.workspace.popOut')} title={translate(locale, 'ai.workspace.popOut')} onClick={() => onPopOut?.({ activeConversationId: conversation.id })}>
            <ArrowSquareOut size={16} />
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon-xs" aria-label={translate(locale, 'ai.workspace.dock')} title={translate(locale, 'ai.workspace.dock')} onClick={onDock}>
            <ArrowSquareIn size={16} />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-xs" aria-label={translate(locale, 'ai.workspace.close')} title={translate(locale, 'ai.workspace.close')} onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
    </div>
  )
}

type ConversationSessionProps = {
  active: boolean
  activeEntry?: VaultEntry | null
  activeNoteContent?: string | null
  aiAgentsStatus: AiAgentsStatus
  conversation: AiConversation
  defaultAiAgentReady: boolean
  entries?: VaultEntry[]
  groups: AiWorkspaceTargetGroups
  locale: AppLocale
  mode: AiWorkspaceMode
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  onArchive: () => void
  onClose: () => void
  onDock?: () => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onForkMessage?: (messageId: string) => void
  onMessageHistoryScrollStateChange?: (scrolled: boolean) => void
  onOpenAiSettings?: () => void
  onOpenNote?: (path: string) => void
  onPopOut?: () => void
  onRestoreVaultAiGuidance?: () => void
  onSelectTarget: (targetId: string) => void
  onStatusChange: (id: string, status: AgentStatus) => void
  onTitleFromPrompt: (request: GenerateAiConversationTitleRequest & { id: string }) => void
  onUnsupportedAiPaste?: (message: string) => void
  onVaultChanged?: () => void
  openTabs?: VaultEntry[]
  target: AiTarget
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  vaultPath: string
  vaultPaths?: string[]
}

function ConversationSession({
  active,
  activeEntry,
  activeNoteContent,
  aiAgentsStatus,
  conversation,
  defaultAiAgentReady,
  entries,
  groups,
  locale,
  mode,
  noteList,
  noteListFilter,
  onArchive,
  onClose,
  onDock,
  onFileCreated,
  onFileModified,
  onForkMessage,
  onMessageHistoryScrollStateChange,
  onOpenAiSettings,
  onOpenNote,
  onPopOut,
  onRestoreVaultAiGuidance,
  onSelectTarget,
  onStatusChange,
  onTitleFromPrompt,
  onUnsupportedAiPaste,
  onVaultChanged,
  openTabs,
  target,
  vaultAiGuidanceStatus,
  vaultPath,
  vaultPaths,
}: ConversationSessionProps) {
  const contextActiveEntry = active ? activeEntry : null
  const contextEntries = active ? entries : undefined
  const readiness = agentReadinessForTarget(target, aiAgentsStatus)
  const controller = useAiPanelController({
    vaultPath,
    vaultPaths,
    defaultAiAgent: targetAgent(target),
    defaultAiTarget: target,
    defaultAiAgentReady: target.kind === 'api_model' || defaultAiAgentReady,
    defaultAiAgentReadiness: readiness,
    activeEntry: contextActiveEntry,
    activeNoteContent: active ? activeNoteContent : null,
    entries: contextEntries,
    openTabs: active ? openTabs : undefined,
    noteList: active ? noteList : undefined,
    noteListFilter: active ? noteListFilter : undefined,
    locale,
    onOpenNote,
    onFileCreated,
    onFileModified,
    onVaultChanged,
    sessionId: conversation.id,
  })
  const running = isRunningStatus(controller.agent.status)
  const composerMenuSide = mode === 'window' ? 'bottom' : 'top'
  const composerControls = (
    <>
      <TargetPicker
        compact
        disabled={running}
        groups={groups}
        locale={locale}
        selectedTarget={target}
        side={composerMenuSide}
        onSelectTarget={onSelectTarget}
      />
      <PermissionPicker
        compact
        disabled={running}
        locale={locale}
        permissionMode={controller.permissionMode}
        side={composerMenuSide}
        targetKind={target.kind}
        onChange={controller.handlePermissionModeChange}
      />
    </>
  )

  useEffect(() => {
    onStatusChange(conversation.id, controller.agent.status)
  }, [conversation.id, controller.agent.status, onStatusChange])

  return (
    <div className={active ? 'flex min-h-0 flex-1 flex-col' : 'hidden'} data-testid={`ai-workspace-session-${conversation.id}`}>
      {mode !== 'side' && (
        <WorkspaceHeader
          archiveDisabled={!canArchiveConversation(conversation)}
          conversation={conversation}
          locale={locale}
          mode={mode}
          onArchive={onArchive}
          onClose={onClose}
          onDock={onDock}
          onOpenAiSettings={onOpenAiSettings}
          onPopOut={onPopOut}
        />
      )}
      <GuidanceWarning locale={locale} onRestore={onRestoreVaultAiGuidance} status={vaultAiGuidanceStatus} />
      <div className="flex min-h-0 flex-1">
        <AiPanelView
          controller={controller}
          defaultAiAgent={targetAgent(target)}
          defaultAiAgentReadiness={readiness}
          defaultAiAgentReady={aiTargetReady(target, aiAgentsStatus)}
          defaultAiTarget={target}
          entries={contextEntries}
          activeEntry={contextActiveEntry}
          composerControls={composerControls}
          interactive={active}
          locale={locale}
          onClose={onClose}
          onForkMessage={onForkMessage}
          onMessageHistoryScrollStateChange={active ? onMessageHistoryScrollStateChange : undefined}
          onOpenNote={onOpenNote}
          onSendPrompt={(prompt) => onTitleFromPrompt({
            id: conversation.id,
            permissionMode: controller.permissionMode,
            prompt,
            target,
            targetReady: aiTargetReady(target, aiAgentsStatus),
            vaultPath,
            vaultPaths,
          })}
          onUnsupportedAiPaste={onUnsupportedAiPaste}
          showHeader={false}
          showLeftBorder={false}
          surface={mode === 'side' ? 'sidebar' : 'default'}
        />
      </div>
    </div>
  )
}

type ResolvedAiWorkspaceProps = AiWorkspaceProps & {
  defaultAiAgent: AiAgentId
  defaultAiAgentReady: boolean
  entries: VaultEntry[]
  locale: AppLocale
  mode: AiWorkspaceMode
}

interface AiWorkspaceModel {
  activeConversation: AiConversation | undefined
  activeId: string
  addDefaultConversation: () => void
  archiveConversationSafely: (id: string) => void
  canArchiveConversation: (conversation: AiConversation) => boolean
  closeConversationSafely: (id: string) => void
  conversations: AiConversation[]
  fallbackTarget: AiTarget
  forkConversationUntilMessage: (sourceId: string, messageId: string) => void
  groups: AiWorkspaceTargetGroups
  handleStatusChange: (id: string, status: AgentStatus) => void
  renameConversation: (id: string, title: string) => void
  reorderConversation: (activeId: string, overId: string) => void
  restoreConversation: (id: string) => void
  sidebarCollapsed: boolean
  setActiveId: (id: string) => void
  setConversationTarget: (id: string, targetId: string) => void
  setShowArchived: (show: boolean) => void
  showArchived: boolean
  statuses: Record<string, AgentStatus>
  titleConversationFromPrompt: (request: GenerateAiConversationTitleRequest & { id: string }) => void
  toggleSidebarCollapsed: () => void
  updateDefaultConversationTargets: (targetId: string) => void
}

function resolveAiWorkspaceProps(props: AiWorkspaceProps): ResolvedAiWorkspaceProps {
  return {
    ...props,
    defaultAiAgent: props.defaultAiAgent ?? DEFAULT_AI_AGENT,
    defaultAiAgentReady: props.defaultAiAgentReady ?? true,
    entries: props.entries ?? [],
    locale: props.locale ?? 'en',
    mode: props.mode ?? 'docked',
  }
}

interface AiWorkspaceSizing {
  onSidebarResize: (delta: number) => void
  onWorkspaceResize: (deltaWidth: number, deltaHeight: number) => void
  sidebarWidth: number
  workspaceSize: { height: number; width: number }
}

function workspaceClassName(mode: AiWorkspaceMode, expanded = false): string {
  if (mode === 'side') {
    return cn(
      'z-20 flex h-full min-h-0 overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground',
      expanded ? 'absolute inset-0 border-l-0' : 'relative shrink-0',
    )
  }

  if (mode === 'window') {
    return 'flex h-full w-full overflow-hidden bg-background text-foreground'
  }

  return 'fixed right-4 bottom-[30px] z-40 flex overflow-hidden rounded-lg border border-border bg-background text-foreground'
}

function workspaceStyle(
  mode: AiWorkspaceMode,
  size: AiWorkspaceSizing['workspaceSize'],
  expanded = false,
): CSSProperties | undefined {
  if (mode === 'window') return undefined
  if (mode === 'side') {
    if (expanded) return undefined
    return {
      minWidth: MIN_SIDE_WORKSPACE_WIDTH,
      width: size.width,
    }
  }

  return {
    height: size.height,
    maxHeight: 'calc(100vh - 62px)',
    maxWidth: 'calc(100vw - 32px)',
    minHeight: MIN_DOCKED_WORKSPACE_SIZE.height,
    minWidth: MIN_DOCKED_WORKSPACE_SIZE.width,
    width: size.width,
  }
}

function startResizeDrag(
  event: ReactMouseEvent,
  cursor: string,
  onDrag: (deltaX: number, deltaY: number) => void,
) {
  event.preventDefault()
  event.stopPropagation()

  let lastX = event.clientX
  let lastY = event.clientY
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - lastX
    const deltaY = moveEvent.clientY - lastY
    lastX = moveEvent.clientX
    lastY = moveEvent.clientY
    onDrag(deltaX, deltaY)
  }
  const handleMouseUp = () => {
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function WorkspaceResizeHandles({
  mode,
  onResize,
}: {
  mode: AiWorkspaceMode
  onResize: (deltaWidth: number, deltaHeight: number) => void
}) {
  if (mode === 'window') return null

  return (
    <>
      <div
        className="absolute inset-y-0 left-0 z-30 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-border"
        data-testid="ai-workspace-left-resize"
        onMouseDown={(event) => startResizeDrag(event, 'col-resize', (deltaX) => onResize(-deltaX, 0))}
      />
      {mode === 'docked' && (
        <div
          className="absolute top-0 right-0 left-0 z-30 h-1 cursor-row-resize bg-transparent transition-colors hover:bg-border"
          data-testid="ai-workspace-top-resize"
          onMouseDown={(event) => startResizeDrag(event, 'row-resize', (_deltaX, deltaY) => onResize(0, -deltaY))}
        />
      )}
    </>
  )
}

function useAiWorkspaceSizing(mode: AiWorkspaceMode): AiWorkspaceSizing {
  const [workspaceSize, setWorkspaceSize] = useState(() => (
    mode === 'side'
      ? { height: DEFAULT_DOCKED_WORKSPACE_SIZE.height, width: readStoredSideWorkspaceWidth() }
      : DEFAULT_DOCKED_WORKSPACE_SIZE
  ))
  const workspaceSizeRef = useRef(workspaceSize)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)

  const onWorkspaceResize = useCallback((deltaWidth: number, deltaHeight: number) => {
    if (mode === 'window') return
    const current = workspaceSizeRef.current
    const max = maxDockedWorkspaceSize()
    const minWidth = mode === 'side' ? MIN_SIDE_WORKSPACE_WIDTH : MIN_DOCKED_WORKSPACE_SIZE.width
    const next = {
      height: clampNumber(current.height + deltaHeight, MIN_DOCKED_WORKSPACE_SIZE.height, max.height),
      width: clampNumber(current.width + deltaWidth, minWidth, max.width),
    }
    workspaceSizeRef.current = next
    if (mode === 'side') writeStoredSideWorkspaceWidth(next.width)
    setWorkspaceSize(next)
  }, [mode])
  const onSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((current) => clampNumber(current + delta, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH))
  }, [])

  useEffect(() => {
    workspaceSizeRef.current = workspaceSize
  }, [workspaceSize])

  useEffect(() => {
    if (mode === 'side') writeStoredSideWorkspaceWidth(workspaceSize.width)
  }, [mode, workspaceSize.width])

  return { onSidebarResize, onWorkspaceResize, sidebarWidth, workspaceSize }
}

function SideWorkspaceTitleEditor({
  conversation,
  locale,
  onCancel,
  onRename,
}: {
  conversation: AiConversation
  locale: AppLocale
  onCancel: () => void
  onRename: (title: string) => void
}) {
  const [draft, setDraft] = useState(conversation.title)
  const finishedRef = useRef(false)
  const submit = () => {
    if (finishedRef.current) return
    const nextTitle = draft.trim()
    if (!nextTitle) {
      finishedRef.current = true
      onCancel()
      return
    }

    finishedRef.current = true
    onRename(nextTitle)
    onCancel()
  }
  const cancel = () => {
    finishedRef.current = true
    onCancel()
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') submit()
        if (event.key === 'Escape') cancel()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={translate(locale, 'ai.workspace.renameChat')}
      className="h-9 w-[180px] rounded-lg px-3 text-[13px] font-semibold"
      autoFocus
    />
  )
}

function SideWorkspaceTab({
  active,
  conversation,
  editing,
  locale,
  onClose,
  onCancelRename,
  onRename,
  onSelect,
  onStartRename,
  status,
}: {
  active: boolean
  conversation: AiConversation
  editing: boolean
  locale: AppLocale
  onClose: (id: string) => void
  onCancelRename: () => void
  onRename: (id: string, title: string) => void
  onSelect: (id: string) => void
  onStartRename: (id: string) => void
  status: AgentStatus | undefined
}) {
  const closeLabel = translate(locale, 'ai.workspace.closeChat', { title: conversation.title })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: conversation.id, disabled: editing })

  return (
    <div
      ref={setNodeRef}
      className="group relative shrink-0"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      {editing ? (
        <SideWorkspaceTitleEditor
          conversation={conversation}
          locale={locale}
          onCancel={onCancelRename}
          onRename={(title) => onRename(conversation.id, title)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-10 shrink-0 cursor-grab justify-start rounded-lg px-3 text-[13px] font-semibold active:cursor-grabbing',
            active
              ? 'bg-[var(--state-hover)] text-foreground'
              : 'text-muted-foreground hover:bg-[var(--state-hover)] hover:text-foreground',
          )}
          {...attributes}
          {...listeners}
          aria-pressed={active}
          onClick={() => onSelect(conversation.id)}
          onDoubleClick={(event) => {
            event.stopPropagation()
            onStartRename(conversation.id)
          }}
        >
          <span className="whitespace-nowrap">{conversation.title}</span>
          {isRunningStatus(status) && <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
        </Button>
      )}
      {!editing && (
        <>
          <div
            className={cn(
              'pointer-events-none absolute inset-y-1 right-0 w-9 rounded-r-lg opacity-0 transition-opacity',
              active
                ? 'bg-gradient-to-l from-[var(--state-hover)] via-[var(--state-hover)] to-transparent'
                : 'bg-gradient-to-l from-sidebar via-sidebar to-transparent group-hover:from-[var(--state-hover)] group-hover:via-[var(--state-hover)]',
              'group-hover:opacity-100 group-focus-within:opacity-100',
            )}
            aria-hidden
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              'pointer-events-none absolute top-1/2 right-1.5 z-10 h-6 w-6 -translate-y-1/2 rounded-md p-0 opacity-0 shadow-none transition-opacity',
              'bg-transparent text-foreground hover:bg-transparent hover:text-foreground',
              'group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100',
            )}
            aria-label={closeLabel}
            title={closeLabel}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onClose(conversation.id)
            }}
          >
            <X size={13} weight="bold" />
          </Button>
        </>
      )}
    </div>
  )
}

function useHorizontalScrollFades(dependencyKey: string) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [fades, setFades] = useState({ left: false, right: false })

  const updateFades = useCallback(() => {
    const element = scrollRef.current
    if (!element) return

    const maxScrollLeft = element.scrollWidth - element.clientWidth
    setFades({
      left: element.scrollLeft > 1,
      right: maxScrollLeft > 1 && element.scrollLeft < maxScrollLeft - 1,
    })
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    updateFades()
    if (!element) return

    element.addEventListener('scroll', updateFades, { passive: true })
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateFades)
    resizeObserver?.observe(element)
    if (element.firstElementChild) resizeObserver?.observe(element.firstElementChild)

    return () => {
      element.removeEventListener('scroll', updateFades)
      resizeObserver?.disconnect()
    }
  }, [dependencyKey, updateFades])

  return {
    scrollRef,
    showLeftFade: fades.left,
    showRightFade: fades.right,
  }
}

function SideWorkspaceHeader({
  activeId,
  conversations,
  expanded,
  locale,
  onClose,
  onCloseConversation,
  onNewChat,
  onRename,
  onReorder,
  onSelect,
  onToggleExpanded,
  separated,
  statuses,
}: {
  activeId: string
  conversations: AiConversation[]
  expanded: boolean
  locale: AppLocale
  onClose: () => void
  onCloseConversation: (id: string) => void
  onNewChat: () => void
  onRename: (id: string, title: string) => void
  onReorder: (activeId: string, overId: string) => void
  onSelect: (id: string) => void
  onToggleExpanded: () => void
  separated: boolean
  statuses: Record<string, AgentStatus>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const visibleConversations = conversations.filter((conversation) => !conversation.archived)
  const visibleConversationIds = visibleConversations.map((conversation) => conversation.id)
  const expandLabel = translate(locale, expanded ? 'ai.workspace.restorePanel' : 'ai.workspace.expandPanel')
  const tabDependencyKey = visibleConversations
    .map((conversation) => `${conversation.id}:${conversation.title}`)
    .join('\0')
  const { scrollRef, showLeftFade, showRightFade } = useHorizontalScrollFades(tabDependencyKey)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activeConversationId = String(event.active.id)
    const overConversationId = event.over ? String(event.over.id) : ''
    if (!overConversationId || activeConversationId === overConversationId) return

    onReorder(activeConversationId, overConversationId)
  }, [onReorder])

  return (
    <div
      className={cn(
        'flex h-[52px] shrink-0 items-center gap-2 px-2',
        separated && 'border-b border-border',
      )}
      data-testid="ai-workspace-side-header"
    >
      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="ai-workspace-side-tabs"
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex w-max items-center gap-1 py-1">
              <SortableContext items={visibleConversationIds} strategy={horizontalListSortingStrategy}>
                {visibleConversations.map((conversation) => (
                  <SideWorkspaceTab
                    key={conversation.id}
                    active={conversation.id === activeId}
                    conversation={conversation}
                    editing={editingId === conversation.id}
                    locale={locale}
                    onCancelRename={() => setEditingId(null)}
                    onClose={onCloseConversation}
                    onRename={onRename}
                    onSelect={onSelect}
                    onStartRename={setEditingId}
                    status={statuses[conversation.id]}
                  />
                ))}
              </SortableContext>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label={translate(locale, 'ai.workspace.newChat')}
                title={translate(locale, 'ai.workspace.newChat')}
                onClick={onNewChat}
              >
                <Plus size={17} />
              </Button>
            </div>
          </DndContext>
        </div>
        {showLeftFade && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-sidebar to-transparent"
            data-testid="ai-workspace-side-tabs-left-fade"
          />
        )}
        {showRightFade && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-sidebar to-transparent"
            data-testid="ai-workspace-side-tabs-right-fade"
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={expandLabel}
        title={expandLabel}
        onClick={onToggleExpanded}
      >
        {expanded ? <ArrowsInLineHorizontal size={17} /> : <ArrowsOutLineHorizontal size={17} />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={translate(locale, 'ai.workspace.close')}
        title={translate(locale, 'ai.workspace.close')}
        onClick={onClose}
      >
        <SidebarSimple size={17} weight="regular" />
      </Button>
    </div>
  )
}

function SideAiWorkspaceLayout({
  model,
  sizing,
  workspace,
}: {
  model: AiWorkspaceModel
  sizing: AiWorkspaceSizing
  workspace: ResolvedAiWorkspaceProps
}) {
  const [expanded, setExpanded] = useState(false)
  const [headerSeparated, setHeaderSeparated] = useState(false)

  return (
    <section
      className={workspaceClassName('side', expanded)}
      style={workspaceStyle('side', sizing.workspaceSize, expanded)}
      data-testid="ai-workspace"
      data-ai-workspace-mode="side"
      data-ai-workspace-expanded={expanded ? 'true' : 'false'}
      role="complementary"
      aria-label={translate(workspace.locale, 'ai.workspace.title')}
    >
      {!expanded && <WorkspaceResizeHandles mode="side" onResize={sizing.onWorkspaceResize} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <SideWorkspaceHeader
          activeId={model.activeId}
          conversations={model.conversations}
          expanded={expanded}
          locale={workspace.locale}
          onClose={workspace.onClose}
          onCloseConversation={model.closeConversationSafely}
          onNewChat={model.addDefaultConversation}
          onRename={model.renameConversation}
          onReorder={model.reorderConversation}
          onSelect={model.setActiveId}
          onToggleExpanded={() => setExpanded((current) => !current)}
          separated={headerSeparated}
          statuses={model.statuses}
        />
        <ConversationSessions model={model} workspace={workspace} onMessageHistoryScrollStateChange={setHeaderSeparated} />
      </div>
    </section>
  )
}

function useActiveConversationSync(
  activeConversation: AiConversation | undefined,
  activeId: string,
  setActiveId: (id: string) => void,
) {
  useEffect(() => {
    if (activeConversation && activeConversation.id !== activeId) setActiveId(activeConversation.id)
  }, [activeConversation, activeId, setActiveId])
}

function useArchiveConversationSafely({
  addConversation,
  archiveConversation,
  conversations,
  fallbackTarget,
}: {
  addConversation: (target: AiTarget) => void
  archiveConversation: (id: string) => void
  conversations: AiConversation[]
  fallbackTarget: AiTarget
}) {
  return useCallback((id: string) => {
    const conversation = conversations.find((candidate) => candidate.id === id)
    if (!conversation || !canArchiveConversation(conversation)) return

    const activeCount = conversations.filter((conversation) => !conversation.archived).length
    archiveConversation(id)
    if (activeCount <= 1) addConversation(fallbackTarget)
  }, [addConversation, archiveConversation, conversations, fallbackTarget])
}

function useTrackedConversationActions({
  conversations,
  renameConversation,
  titleConversationFromPrompt,
}: {
  conversations: AiConversation[]
  renameConversation: (id: string, title: string) => void
  titleConversationFromPrompt: (request: GenerateAiConversationTitleRequest & { id: string }) => void
}) {
  const trackedRenameConversation = useCallback((id: string, title: string) => {
    if (!title.trim()) return
    renameConversation(id, title)
    trackAiWorkspaceChatTitled('manual')
  }, [renameConversation])
  const trackedTitleConversationFromPrompt = useCallback((request: GenerateAiConversationTitleRequest & { id: string }) => {
    const conversation = conversations.find((candidate) => candidate.id === request.id)
    titleConversationFromPrompt(request)
    if (conversation?.usesDefaultTitle) trackAiWorkspaceChatTitled('generated')
  }, [conversations, titleConversationFromPrompt])

  return { trackedRenameConversation, trackedTitleConversationFromPrompt }
}

function useAiWorkspaceNewChatEvent(open: boolean, addDefaultConversation: () => void) {
  useEffect(() => {
    if (!open) return
    const handleNewChat = () => addDefaultConversation()
    window.addEventListener(NEW_AI_CHAT_EVENT, handleNewChat)
    return () => window.removeEventListener(NEW_AI_CHAT_EVENT, handleNewChat)
  }, [addDefaultConversation, open])
}

function useAiWorkspaceModel(workspace: ResolvedAiWorkspaceProps): AiWorkspaceModel {
  const groups = useMemo(
    () => buildAiWorkspaceTargetGroups(workspace.aiAgentsStatus, workspace.aiModelProviders),
    [workspace.aiAgentsStatus, workspace.aiModelProviders],
  )
  const fallbackTarget = useMemo(
    () => firstTarget(groups, workspace.defaultAiTarget, workspace.defaultAiAgent),
    [groups, workspace.defaultAiAgent, workspace.defaultAiTarget],
  )
  const {
    activeId,
    addConversation,
    archiveConversation,
    closeConversation,
    conversations,
    forkConversation,
    renameConversation,
    reorderConversation,
    restoreConversation,
    setActiveId,
    setConversationTarget,
    setShowArchived,
    showArchived,
    titleConversationFromPrompt,
    updateDefaultConversationTargets,
  } = useConversations({
    fallbackTarget,
    initialActiveConversationId: workspace.initialActiveConversationId,
    locale: workspace.locale,
    onSettingsChange: workspace.onConversationSettingsChange,
    settings: workspace.conversationSettings,
    settingsReady: workspace.conversationSettingsReady ?? true,
  })
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const activeConversation = activeConversationForState(conversations, activeId, showArchived)

  const addDefaultConversation = useCallback(() => {
    addConversation(fallbackTarget)
  }, [addConversation, fallbackTarget])
  const archiveConversationSafely = useArchiveConversationSafely({
    addConversation,
    archiveConversation,
    conversations,
    fallbackTarget,
  })
  useActiveConversationSync(activeConversation, activeId, setActiveId)
  const handleStatusChange = useCallback((id: string, status: AgentStatus) => {
    setStatuses((current) => current[id] === status ? current : { ...current, [id]: status })
  }, [])
  const forkConversationUntilMessage = useCallback((sourceId: string, messageId: string) => {
    const targetId = forkConversation(sourceId)
    if (!targetId) return

    cloneAiWorkspaceSessionUntilMessage(sourceId, targetId, messageId)
  }, [forkConversation])
  const { trackedRenameConversation, trackedTitleConversationFromPrompt } = useTrackedConversationActions({
    conversations,
    renameConversation,
    titleConversationFromPrompt,
  })
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current
      trackAiWorkspaceSidebarToggled(next, workspace.mode)
      return next
    })
  }, [workspace.mode])

  useAiWorkspaceNewChatEvent(workspace.open, addDefaultConversation)
  useEffect(() => {
    updateDefaultConversationTargets(fallbackTarget.id)
  }, [fallbackTarget.id, updateDefaultConversationTargets])

  return {
    activeConversation,
    activeId,
    addDefaultConversation,
    archiveConversationSafely,
    canArchiveConversation,
    closeConversationSafely: closeConversation,
    conversations,
    fallbackTarget,
    forkConversationUntilMessage,
    groups,
    handleStatusChange,
    renameConversation: trackedRenameConversation,
    reorderConversation,
    restoreConversation,
    sidebarCollapsed,
    setActiveId,
    setConversationTarget,
    setShowArchived,
    showArchived,
    statuses,
    titleConversationFromPrompt: trackedTitleConversationFromPrompt,
    toggleSidebarCollapsed,
    updateDefaultConversationTargets,
  }
}

function AiWorkspaceLayout({ model, workspace }: { model: AiWorkspaceModel; workspace: ResolvedAiWorkspaceProps }) {
  const sizing = useAiWorkspaceSizing(workspace.mode)
  if (workspace.mode === 'side') {
    return <SideAiWorkspaceLayout model={model} sizing={sizing} workspace={workspace} />
  }

  return (
    <section
      className={workspaceClassName(workspace.mode)}
      style={workspaceStyle(workspace.mode, sizing.workspaceSize)}
      data-testid="ai-workspace"
      data-ai-workspace-mode={workspace.mode}
      role="dialog"
      aria-label={translate(workspace.locale, 'ai.workspace.title')}
    >
      <WorkspaceResizeHandles mode={workspace.mode} onResize={sizing.onWorkspaceResize} />
      <ConversationSidebar
        activeId={model.activeId}
        collapsed={model.sidebarCollapsed}
        conversations={model.conversations}
        locale={workspace.locale}
        onCanArchive={model.canArchiveConversation}
        onArchive={model.archiveConversationSafely}
        onNewChat={model.addDefaultConversation}
        onRename={model.renameConversation}
        onRestore={model.restoreConversation}
        onSelect={model.setActiveId}
        onToggleCollapsed={model.toggleSidebarCollapsed}
        setShowArchived={model.setShowArchived}
        showArchived={model.showArchived}
        sidebarWidth={sizing.sidebarWidth}
        statuses={model.statuses}
      />
      {!model.sidebarCollapsed && (
        <ResizeHandle onResize={sizing.onSidebarResize} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <ConversationSessions model={model} workspace={workspace} />
      </div>
    </section>
  )
}

function ConversationSessions({
  model,
  onMessageHistoryScrollStateChange,
  workspace,
}: {
  model: AiWorkspaceModel
  onMessageHistoryScrollStateChange?: (scrolled: boolean) => void
  workspace: ResolvedAiWorkspaceProps
}) {
  return (
    <div className="flex min-h-0 flex-1">
      {model.conversations.map((conversation) => {
        const target = resolveTarget(conversation, model.groups, model.fallbackTarget)

        return (
          <ConversationSession
            key={conversation.id}
            active={conversation.id === model.activeConversation?.id}
            activeEntry={workspace.activeEntry}
            activeNoteContent={workspace.activeNoteContent}
            aiAgentsStatus={workspace.aiAgentsStatus}
            conversation={conversation}
            defaultAiAgentReady={workspace.defaultAiAgentReady}
            entries={workspace.entries}
            groups={model.groups}
            locale={workspace.locale}
            mode={workspace.mode}
            noteList={workspace.noteList}
            noteListFilter={workspace.noteListFilter}
            onArchive={() => model.archiveConversationSafely(conversation.id)}
            onClose={workspace.onClose}
            onDock={workspace.onDock}
            onFileCreated={workspace.onFileCreated}
            onFileModified={workspace.onFileModified}
            onForkMessage={(messageId) => model.forkConversationUntilMessage(conversation.id, messageId)}
            onMessageHistoryScrollStateChange={onMessageHistoryScrollStateChange}
            onOpenAiSettings={workspace.onOpenAiSettings}
            onOpenNote={workspace.onOpenNote}
            onPopOut={workspace.onPopOut}
            onRestoreVaultAiGuidance={workspace.onRestoreVaultAiGuidance}
            onSelectTarget={(targetId) => model.setConversationTarget(conversation.id, targetId)}
            onStatusChange={model.handleStatusChange}
            onTitleFromPrompt={model.titleConversationFromPrompt}
            onUnsupportedAiPaste={workspace.onUnsupportedAiPaste}
            onVaultChanged={workspace.onVaultChanged}
            openTabs={workspace.openTabs}
            target={target}
            vaultAiGuidanceStatus={workspace.vaultAiGuidanceStatus}
            vaultPath={workspace.vaultPath}
            vaultPaths={workspace.vaultPaths}
          />
        )
      })}
    </div>
  )
}

export function AiWorkspace(props: AiWorkspaceProps) {
  const workspace = resolveAiWorkspaceProps(props)
  const model = useAiWorkspaceModel(workspace)
  const { onActiveConversationChange } = workspace

  useEffect(() => {
    if (!workspace.open || !model.activeId) return
    onActiveConversationChange?.(model.activeId)
  }, [model.activeId, onActiveConversationChange, workspace.open])

  if (!workspace.open || !model.activeConversation) return null

  return <AiWorkspaceLayout model={model} workspace={workspace} />
}
