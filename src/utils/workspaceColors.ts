import workspaceColorContract from '../shared/workspaceColorContract.json'

export type WorkspaceColor = keyof typeof workspaceColorContract.colors

export const DEFAULT_WORKSPACE_COLOR = workspaceColorContract.default as WorkspaceColor
export const WORKSPACE_COLORS = Object.freeze(
  Object.keys(workspaceColorContract.colors),
) as readonly WorkspaceColor[]

export function workspaceColorSupportsNativeIcon(color: WorkspaceColor): boolean {
  return workspaceColorContract.colors[color].nativeIcon !== null
}
