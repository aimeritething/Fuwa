import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import { TooltipProvider } from '@/ui/tooltip'
import { AppPreferencesProvider } from '@/lib/useAppPreferences'
import './index.css'
import App from './App.tsx'
import { applyStoredThemeMode } from '@/shell/themeMode'
import { installMockVault, isTauri } from '@/platform/tauri'

const TLDRAW_CONTEXT_MENU_SELECTOR = '.tldraw-whiteboard'

function dataTransferHasFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.files.length > 0) return true
  if (Array.from(dataTransfer.types).includes('Files')) return true

  return Array.from(dataTransfer.items).some((item) => item.kind === 'file')
}

function preventFileDropNavigation(event: DragEvent): void {
  if (!dataTransferHasFiles(event.dataTransfer)) return

  event.preventDefault()
}

function isTldrawContextMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TLDRAW_CONTEXT_MENU_SELECTOR) !== null
}

function preventNativeContextMenu(event: MouseEvent): void {
  if (isTldrawContextMenuTarget(event.target)) return

  event.preventDefault()
}

document.addEventListener('dragover', preventFileDropNavigation, true)
document.addEventListener('drop', preventFileDropNavigation, true)

// Disable native WebKit context menu in Tauri (WKWebView intercepts right-click
// at native level before React's synthetic events can call preventDefault).
// Capture phase fires first → prevents native menu; React bubble phase still fires
// → our custom context menus (e.g. sidebar right-click) work correctly.
if (isTauri()) {
  document.addEventListener('contextmenu', preventNativeContextMenu, true)
}

applyStoredThemeMode(document, window.localStorage)

// Outside Tauri the in-memory Folder fixture stands in for the Rust side; the
// smoke specs reach it through window.__fuwaMockVault.
if (import.meta.env.DEV && !isTauri()) {
  installMockVault()
}

function getRequiredRootElement(): HTMLElement {
  const root = document.getElementById('root')
  if (!root) throw new Error('Fuwa root element is missing')
  return root
}

createRoot(getRequiredRootElement()).render(
  <StrictMode>
    <AppPreferencesProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </AppPreferencesProvider>
  </StrictMode>,
)
