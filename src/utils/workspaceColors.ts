import workspaceColorContract from '../shared/workspaceColorContract.json'

export type WorkspaceColor = keyof typeof workspaceColorContract.colors

export const DEFAULT_WORKSPACE_COLOR = workspaceColorContract.default as WorkspaceColor
export const WORKSPACE_COLORS = Object.freeze(
  Object.keys(workspaceColorContract.colors),
) as readonly WorkspaceColor[]

const NATIVE_ICON_WORKSPACE_COLORS = Object.freeze(
  Object.entries(workspaceColorContract.colors)
    .filter(([, definition]) => definition.nativeIcon !== null)
    .map(([color]) => color as WorkspaceColor),
)

export function workspaceColorSupportsNativeIcon(color: WorkspaceColor): boolean {
  return NATIVE_ICON_WORKSPACE_COLORS.includes(color)
}
