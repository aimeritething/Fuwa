import type { CommandAction } from './types'
import type { SidebarSelection } from '../../types'

interface GitCommandsConfig {
  modifiedCount: number
  onCommitPush: () => void
  onPull?: () => void
  onResolveConflicts?: () => void
  onSelect: (sel: SidebarSelection) => void
}

export function buildGitCommands(config: GitCommandsConfig): CommandAction[] {
  const { modifiedCount, onCommitPush, onPull, onResolveConflicts, onSelect } = config
  return [
    { id: 'commit-push', label: 'Commit & Push', group: 'Git', keywords: ['git', 'save', 'sync'], enabled: modifiedCount > 0, execute: onCommitPush },
    { id: 'git-pull', label: 'Pull from Remote', group: 'Git', keywords: ['git', 'pull', 'fetch', 'download', 'sync', 'remote'], enabled: true, execute: () => onPull?.() },
    { id: 'resolve-conflicts', label: 'Resolve Conflicts', group: 'Git', keywords: ['conflict', 'merge', 'git', 'sync'], enabled: true, execute: () => onResolveConflicts?.() },
    { id: 'view-changes', label: 'View Pending Changes', group: 'Git', keywords: ['modified', 'diff'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },
  ]
}
