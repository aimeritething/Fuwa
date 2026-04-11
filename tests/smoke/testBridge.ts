import { type Page } from '@playwright/test'

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
