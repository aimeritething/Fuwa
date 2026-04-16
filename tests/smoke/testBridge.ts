import { type Page } from '@playwright/test'
import type {
  AppCommandId,
  AppCommandShortcutEventInit,
  AppCommandShortcutEventOptions,
} from '../../src/hooks/appCommandCatalog'

async function waitForDispatchBrowserMenuCommand(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__laputaTest?.dispatchBrowserMenuCommand === 'function',
    undefined,
    { timeout: 5_000 },
  )
}

function shouldFallbackToDispatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('dispatchBrowserMenuCommand')
}

async function tryTriggerMenuCommand(commandId: string): Promise<boolean> {
  const triggerMenuCommand = window.__laputaTest?.triggerMenuCommand
  if (typeof triggerMenuCommand !== 'function') {
    return false
  }

  try {
    await triggerMenuCommand(commandId)
    return true
  } catch (error) {
    if (!shouldFallbackToDispatch(error)) {
      throw error
    }
    return false
  }
}

async function dispatchMenuCommandInPage(commandId: string): Promise<void> {
  const dispatchBrowserMenuCommand = window.__laputaTest?.dispatchBrowserMenuCommand

  if (typeof dispatchBrowserMenuCommand !== 'function') {
    throw new Error('Tolaria test bridge is missing dispatchBrowserMenuCommand')
  }

  const didTrigger = await tryTriggerMenuCommand(commandId)
  if (didTrigger) {
    return
  }

  dispatchBrowserMenuCommand(commandId)
}

export async function triggerMenuCommand(page: Page, id: string): Promise<void> {
  await waitForDispatchBrowserMenuCommand(page)
  await page.evaluate(dispatchMenuCommandInPage, id)
}

export async function seedBlockNoteTable(
  page: Page,
  columnWidths?: Array<number | null>,
): Promise<void> {
  await page.evaluate((widths) => {
    const bridge = window.__laputaTest?.seedBlockNoteTable
    if (typeof bridge !== 'function') {
      throw new Error('Tolaria test bridge is missing seedBlockNoteTable')
    }
    return bridge(widths ?? undefined)
  }, columnWidths)
}

export async function seedAutoGitSavedChange(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const bridge = window.__laputaTest?.seedAutoGitSavedChange
    if (typeof bridge !== 'function') {
      throw new Error('Tolaria test bridge is missing seedAutoGitSavedChange')
    }
    await bridge()
  })
}

export async function dispatchShortcutEvent(
  page: Page,
  init: AppCommandShortcutEventInit,
): Promise<void> {
  await page.evaluate((eventInit) => {
    const bridge = window.__laputaTest?.dispatchShortcutEvent
    if (typeof bridge !== 'function') {
      throw new Error('Tolaria test bridge is missing dispatchShortcutEvent')
    }
    bridge(eventInit)
  }, init)
}

export async function triggerShortcutCommand(
  page: Page,
  id: AppCommandId,
  options?: AppCommandShortcutEventOptions,
): Promise<void> {
  await page.evaluate((payload) => {
    const bridge = window.__laputaTest?.triggerShortcutCommand
    if (typeof bridge !== 'function') {
      throw new Error('Tolaria test bridge is missing triggerShortcutCommand')
    }
    bridge(payload.id, payload.options)
  }, { id, options })
}
