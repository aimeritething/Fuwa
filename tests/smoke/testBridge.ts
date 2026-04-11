import { type Page } from '@playwright/test'

export async function triggerMenuCommand(page: Page, id: string): Promise<void> {
  await page.evaluate(async (commandId) => {
    if (!window.__laputaTest?.triggerMenuCommand) {
      throw new Error('Laputa test bridge is missing triggerMenuCommand')
    }
    await window.__laputaTest.triggerMenuCommand(commandId)
  }, id)
}
