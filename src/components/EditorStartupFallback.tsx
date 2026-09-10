import { formatShortcutDisplay } from '../hooks/appCommandCatalog'
import { translate, type AppLocale } from '../lib/i18n'
import type { ReactNode } from 'react'

interface EditorStartupFallbackProps {
  activeTabPath: string | null
  isVaultLoading?: boolean
  locale?: AppLocale
  showAIChat?: boolean
  aiWorkspaceSurface?: ReactNode
}

function LoadingBreadcrumb() {
  return (
    <div className="flex h-[52px] shrink-0 items-center px-4">
      <span
        aria-hidden="true"
        data-testid="breadcrumb-title-skeleton"
        className="h-4 w-36 animate-pulse rounded bg-muted"
      />
    </div>
  )
}

function EmptyEditor({ locale = 'en' }: { locale?: AppLocale }) {
  const quickOpen = formatShortcutDisplay({ display: '⌘P / ⌘O' })
  const newNote = formatShortcutDisplay({ display: '⌘N' })
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div aria-hidden="true" data-tauri-drag-region className="h-[52px] shrink-0" />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <p className="m-0 text-[15px]">{translate(locale, 'editor.empty.selectNote')}</p>
        <span className="text-xs text-muted-foreground">
          {translate(locale, 'editor.empty.shortcuts', { quickOpen, newNote })}
        </span>
      </div>
    </div>
  )
}

export function EditorStartupFallback(props: EditorStartupFallbackProps) {
  const showEmpty = !props.isVaultLoading && props.activeTabPath === null
  return (
    <div className="editor flex min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="editor-module-loading">
      {showEmpty ? <EmptyEditor locale={props.locale} /> : <LoadingBreadcrumb />}
      {props.showAIChat ? props.aiWorkspaceSurface : null}
    </div>
  )
}
