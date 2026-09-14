import { useCallback } from 'react'
import {
  LinkToolbarController,
  SideMenuController,
  SuggestionMenuController,
  type FormattingToolbarProps,
  type SideMenuProps,
} from '@blocknote/react'
import type { AppLocale } from '@/lib/i18n'
import { FilePanelController } from './file-panel'
import { LinkToolbar } from '@/kernel/blocknote/link-toolbar'
import { SlashMenu } from '@/kernel/blocknote/slash-menu'
import { CollapsedHeadingsController, SideMenu } from '@/kernel/blocknote/block-note-side-menu'
import { FormattingToolbar, FormattingToolbarController } from '@/kernel/blocknote/editor-formatting'
import type { SuggestionAction } from '@/kernel/blocknote/single-editor-suggestion-items'
import type { useSuggestionMenuItems } from '@/kernel/blocknote/single-editor-suggestion-items'

type EditorInteractionControllersProps = ReturnType<typeof useSuggestionMenuItems> & {
  locale: AppLocale
  onToolbarMouseDown: (event: Pick<React.MouseEvent<HTMLElement>, 'target' | 'preventDefault'>) => void
  runEditorAction: (action: SuggestionAction) => void
  vaultPath?: string
}

function EditorToolbarControllers({
  locale,
  onToolbarMouseDown,
  vaultPath,
}: Pick<EditorInteractionControllersProps, 'locale' | 'onToolbarMouseDown' | 'vaultPath'>) {
  const sideMenu = useCallback((props: SideMenuProps) => <SideMenu {...props} locale={locale} />, [locale])
  const formattingToolbar = useCallback(
    (props: FormattingToolbarProps) => (
      <FormattingToolbar {...props} locale={locale} vaultPath={vaultPath} />
    ),
    [locale, vaultPath],
  )
  const linkToolbar = useCallback(
    (props: React.ComponentProps<typeof LinkToolbar>) => (
      <LinkToolbar {...props} vaultPath={vaultPath} />
    ),
    [vaultPath],
  )
  const floatingUIOptions = { elementProps: { onMouseDownCapture: onToolbarMouseDown } }

  return (
    <>
      <CollapsedHeadingsController />
      <SideMenuController sideMenu={sideMenu} />
      <FormattingToolbarController
        formattingToolbar={formattingToolbar}
        floatingUIOptions={floatingUIOptions}
      />
      <LinkToolbarController linkToolbar={linkToolbar} floatingUIOptions={floatingUIOptions} />
      <FilePanelController />
    </>
  )
}

function EditorSuggestionControllers({
  getSlashMenuItems,
}: Pick<EditorInteractionControllersProps, 'getSlashMenuItems'>) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getSlashMenuItems}
      suggestionMenuComponent={SlashMenu}
    />
  )
}

export function EditorInteractionControllers(props: EditorInteractionControllersProps) {
  return (
    <>
      <EditorToolbarControllers {...props} />
      <EditorSuggestionControllers {...props} />
    </>
  )
}
