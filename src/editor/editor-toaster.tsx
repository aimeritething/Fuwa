import { Toaster } from 'sonner'
import type { ThemeMode } from '@/shell/theme-mode'

const TOAST_DURATION_MS = 4_000

/**
 * Sonner's toaster in its own look, pinned to the editor pane's bottom-right
 * rather than the window's: Sonner positions it fixed, and the inline
 * `position: absolute` puts it inside the pane, which is `relative`.
 */
export function EditorToaster({ theme }: { theme: ThemeMode }) {
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={16}
      visibleToasts={3}
      duration={TOAST_DURATION_MS}
      style={{ position: 'absolute', zIndex: 'var(--z-toast)' }}
    />
  )
}
