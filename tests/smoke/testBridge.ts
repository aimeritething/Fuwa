import { type Page } from '@playwright/test'
import type {
  AppCommandId,
  AppCommandShortcutEventInit,
  AppCommandShortcutEventOptions,
} from '../../src/hooks/appCommandCatalog'

export async function triggerMenuCommand(page: Page, id: string): Promise<void> {
  await page.evaluate(async (commandId) => {
    const deadline = Date.now() + 5_000

    while (Date.now() < deadline) {
      const bridge = window.__laputaTest
      const dispatchBrowserMenuCommand = bridge?.dispatchBrowserMenuCommand
      const triggerMenuCommand = bridge?.triggerMenuCommand

      if (typeof dispatchBrowserMenuCommand === 'function') {
        if (typeof triggerMenuCommand === 'function') {
          try {
            await triggerMenuCommand(commandId)
            return
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!message.includes('dispatchBrowserMenuCommand')) {
              throw error
            }
          }
        }

        dispatchBrowserMenuCommand(commandId)
        return
      }

      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }

    throw new Error('Laputa test bridge is missing dispatchBrowserMenuCommand')
  }, id)
}

export async function dispatchShortcutEvent(
  page: Page,
  init: AppCommandShortcutEventInit,
): Promise<void> {
  await page.evaluate((eventInit) => {
    const bridge = window.__laputaTest?.dispatchShortcutEvent
    if (typeof bridge !== 'function') {
      throw new Error('Laputa test bridge is missing dispatchShortcutEvent')
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
      throw new Error('Laputa test bridge is missing triggerShortcutCommand')
    }
    bridge(payload.id, payload.options)
  }, { id, options })
}
