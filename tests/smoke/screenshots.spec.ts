import { expect, test, type Page } from '@playwright/test'
// Type-only: brings the fixture's `window.__fuwaMockVault` declaration into the spec program.
import type { MockVault } from '../../src/platform/mock/vaultFixture'
import { MOCK_FOLDER, WELCOME_PATH } from './harness'

// The appearance baseline: five composite states of the window, light and
// dark, frozen as PNGs beside this file (`screenshots.spec.ts-snapshots/`).
//
// A tool, not a gate. Nothing in CI runs it. Before a UI rewrite PR, run
//
//   pnpm smoke:screenshots
//
// against the branch. A red test means the pixels moved; open the diff in
// `test-results/` (expected / actual / diff side by side) and decide whether
// the change is the rewrite's doing or the intended appearance. Once the new
// look is accepted, re-freeze it:
//
//   pnpm smoke:screenshots --update-snapshots
//
// The comparison is on the window at 1200×800 (the harness viewport), the
// caret hidden and CSS animations disabled. The threshold below only absorbs
// anti-aliasing shimmer: `threshold` is per-pixel colour distance (0 to 1,
// Playwright's default 0.2), `maxDiffPixels` the count of pixels allowed past
// it. A one-pixel shift of a line of text or a border already exceeds it;
// that is the point.
const SCREENSHOT_OPTIONS = { animations: 'disabled', caret: 'hide', threshold: 0.2, maxDiffPixels: 200 } as const

const FUWA_PATH = `${MOCK_FOLDER}/Projects/Fuwa.md`
const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]

/** Plant a Session file with the fixture and reload, so the state is there from the first paint. */
async function launchWith(page: Page, session: Record<string, unknown>) {
  await page.goto('/')
  await page.evaluate((seed) => {
    const vault: MockVault | undefined = window.__fuwaMockVault
    if (!vault) throw new Error('The Folder fixture is not installed')
    vault.seedSession(seed)
  }, session)
  await page.reload()
}

/** The Folder open, Welcome.md and Projects/Fuwa.md as Tabs, `active` in front. */
function folderSession(theme: Theme, active: 'welcome' | 'fuwa', mode: 'rich' | 'raw' = 'rich') {
  return {
    version: 1,
    folder: MOCK_FOLDER,
    openEditors: [
      { path: WELCOME_PATH, mode: active === 'welcome' ? mode : 'rich' },
      { path: FUWA_PATH, mode: active === 'fuwa' ? mode : 'rich' },
    ],
    activePath: active === 'welcome' ? WELCOME_PATH : FUWA_PATH,
    theme,
    sidebar: { collapsed: false, width: 260 },
  }
}

async function settled(page: Page, theme: Theme) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.evaluate(() => document.fonts.ready)
}

async function openWelcomeInFolder(page: Page, theme: Theme) {
  await launchWith(page, folderSession(theme, 'welcome'))
  await expect(page.getByRole('tree')).toBeVisible()
  await expect(page.getByTestId('open-editors')).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.locator('.bn-editor h1')).toHaveText('Welcome')
  await settled(page, theme)
}

for (const theme of THEMES) {
  test.describe(theme, () => {
    test('first launch: no Folder, no Tab', async ({ page }) => {
      await launchWith(page, { version: 1, folder: null, openEditors: [], activePath: null, theme, sidebar: { collapsed: false, width: 260 } })
      await expect(page.getByTestId('editor-empty-state')).toBeVisible()
      await settled(page, theme)

      await expect(page).toHaveScreenshot(`first-launch-${theme}.png`, SCREENSHOT_OPTIONS)
    })

    test('Folder open, a Document in Rich mode, two Tabs and Open Editors', async ({ page }) => {
      await openWelcomeInFolder(page, theme)

      await expect(page).toHaveScreenshot(`folder-rich-${theme}.png`, SCREENSHOT_OPTIONS)
    })

    test('the same Folder, a Document with Frontmatter in Raw mode', async ({ page }) => {
      await launchWith(page, folderSession(theme, 'fuwa', 'raw'))
      await expect(page.getByRole('tree')).toBeVisible()
      await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible()
      await expect(page.locator('.cm-content')).toContainText('title: Fuwa')
      await expect(page.getByTestId('path-row-frontmatter')).toHaveText('frontmatter · 1 key')
      await settled(page, theme)

      await expect(page).toHaveScreenshot(`folder-raw-${theme}.png`, SCREENSHOT_OPTIONS)
    })

    test('the Command Menu open over the Document', async ({ page }) => {
      await openWelcomeInFolder(page, theme)
      await page.keyboard.press('Meta+k')
      await expect(page.getByTestId('command-menu')).toBeVisible()
      await expect(page.getByTestId('command-menu-row').first()).toBeVisible()

      await expect(page).toHaveScreenshot(`command-menu-${theme}.png`, SCREENSHOT_OPTIONS)
    })

    test('the formatting toolbar over a selected paragraph', async ({ page }) => {
      await openWelcomeInFolder(page, theme)
      await page.locator('.bn-editor p').first().click({ clickCount: 3 })
      await expect(page.locator('.bn-formatting-toolbar')).toBeVisible()

      await expect(page).toHaveScreenshot(`formatting-toolbar-${theme}.png`, SCREENSHOT_OPTIONS)
    })
  })
}
