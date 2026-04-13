import type { CSSProperties } from 'react'

export const PROPERTY_PANEL_GRID_STYLE = {
  gridTemplateColumns: 'fit-content(50%) minmax(0, 1fr)',
} satisfies CSSProperties

export const PROPERTY_PANEL_ROW_STYLE = {
  gridColumn: '1 / -1',
  gridTemplateColumns: 'subgrid',
} satisfies CSSProperties
