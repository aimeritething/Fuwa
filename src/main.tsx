import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App.tsx'
import NoteWindow from './NoteWindow.tsx'
import { isNoteWindow } from './utils/windowMode'

// Disable native WebKit context menu in Tauri (WKWebView intercepts right-click
// at native level before React's synthetic events can call preventDefault).
// Capture phase fires first → prevents native menu; React bubble phase still fires
// → our custom context menus (e.g. sidebar right-click) work correctly.
if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true)
}

const RootComponent = isNoteWindow() ? NoteWindow : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <RootComponent />
    </TooltipProvider>
  </StrictMode>,
)
