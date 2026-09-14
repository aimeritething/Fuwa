import { expect, test, type Page } from '@playwright/test'
import type { MockVault } from '../../src/platform/mock/vault-fixture'
import { MOCK_FOLDER, WELCOME_PATH } from './harness'

// PROTOTYPE AIM-433, untracked: the hover, selected and focus states the
// appearance baseline never captures, compared main vs the pilot branch.
const OPTS = { animations: 'disabled', caret: 'hide', threshold: 0.2, maxDiffPixels: 200 } as const
const FUWA_PATH = `${MOCK_FOLDER}/Projects/Fuwa.md`

async function launch(page: Page, theme: 'light' | 'dark', collapsed = false) {
  await page.goto('/')
  await page.evaluate(({ seed }) => {
    const vault: MockVault | undefined = window.__fuwaMockVault
    if (!vault) throw new Error('no fixture')
    vault.seedSession(seed)
  }, { seed: {
    version: 1, folder: MOCK_FOLDER,
    openEditors: [{ path: WELCOME_PATH, mode: 'rich' }, { path: FUWA_PATH, mode: 'rich' }],
    activePath: WELCOME_PATH, theme, sidebar: { collapsed, width: 260 },
  } })
  await page.reload()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.evaluate(() => document.fonts.ready)
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: hover the inactive tab`, async ({ page }) => {
    await launch(page, theme)
    await page.getByRole('tab', { name: 'Fuwa.md' }).hover()
    await expect(page).toHaveScreenshot(`tab-hover-${theme}.png`, OPTS)
  })
  test(`${theme}: hover the inactive Open Editors row`, async ({ page }) => {
    await launch(page, theme)
    await page.getByRole('option', { name: 'Fuwa.md' }).hover()
    await expect(page).toHaveScreenshot(`row-hover-${theme}.png`, OPTS)
  })
  test(`${theme}: hover the close × on the active tab`, async ({ page }) => {
    await launch(page, theme)
    await page.getByRole('tab', { name: 'Welcome.md' }).getByRole('button').hover()
    await expect(page).toHaveScreenshot(`close-hover-${theme}.png`, OPTS)
  })
  test(`${theme}: hover the sidebar toggle, tooltip open`, async ({ page }) => {
    await launch(page, theme)
    await page.getByRole('button', { name: 'Hide sidebar' }).hover()
    await expect(page.getByRole('tooltip')).toBeVisible()
    await expect(page).toHaveScreenshot(`toggle-tooltip-${theme}.png`, OPTS)
  })
  test(`${theme}: keyboard focus on the active tab and on the active row`, async ({ page }) => {
    await launch(page, theme)
    await page.getByRole('tab', { name: 'Welcome.md' }).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(page).toHaveScreenshot(`tab-focus-${theme}.png`, OPTS)
    await page.getByRole('option', { name: 'Welcome.md' }).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(page).toHaveScreenshot(`row-focus-${theme}.png`, OPTS)
  })
  test(`${theme}: collapsed, the tab bar seats the lights and the toggle`, async ({ page }) => {
    await launch(page, theme, true)
    await expect(page.getByTestId('collapsed-chrome')).toBeVisible()
    await expect(page).toHaveScreenshot(`collapsed-${theme}.png`, OPTS)
  })
  test(`${theme}: hover the Explorer row`, async ({ page }) => {
    await launch(page, theme)
    await page.getByTestId(`explorer-row:${MOCK_FOLDER}/Reading list.md`).hover()
    await expect(page).toHaveScreenshot(`explorer-hover-${theme}.png`, OPTS)
  })
}
