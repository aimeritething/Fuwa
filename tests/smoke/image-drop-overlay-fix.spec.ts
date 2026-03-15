import { test, expect } from '@playwright/test'

const DROP_OVERLAY = '.editor__drop-overlay'
const EDITOR_CONTAINER = '.editor__blocknote-container'

async function openFirstNote(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.waitFor({ timeout: 5_000 })
  await noteList.locator('.cursor-pointer').first().click()
  await page.waitForTimeout(300)
  await page.waitForSelector(EDITOR_CONTAINER, { timeout: 5_000 })
}

/** Dispatch a DragEvent with an image file on the editor container to show the overlay. */
async function showOverlayViaImageDragover(page: import('@playwright/test').Page) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error('Editor container not found')
    const dt = new DataTransfer()
    dt.items.add(new File(['fake'], 'photo.png', { type: 'image/png' }))
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
  }, EDITOR_CONTAINER)
  await expect(page.locator(DROP_OVERLAY)).toBeVisible()
}

test.describe('Image drop overlay — internal drag does not trigger overlay', () => {
  test.beforeEach(async ({ page }) => { await openFirstNote(page) })

  test('internal drag (no image files) does not show the overlay', async ({ page }) => {
    await page.locator(EDITOR_CONTAINER).first().dispatchEvent('dragover', {
      bubbles: true,
      cancelable: true,
    })
    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()
  })

  test('dragover with image file shows the overlay', async ({ page }) => {
    await showOverlayViaImageDragover(page)
    await expect(page.locator(DROP_OVERLAY)).toContainText('Drop image here')
  })

  test('dragleave after image dragover hides the overlay', async ({ page }) => {
    await showOverlayViaImageDragover(page)

    await page.evaluate((sel) => {
      const el = document.querySelector(sel)!
      el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: document.body }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()
  })

  test('drop resets the overlay', async ({ page }) => {
    await showOverlayViaImageDragover(page)

    await page.evaluate((sel) => {
      const el = document.querySelector(sel)!
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()
  })
})

test.describe('Block handle (side menu) is not clipped by editor overflow', () => {
  test.beforeEach(async ({ page }) => { await openFirstNote(page) })

  test('side menu is fully visible within container bounds on hover', async ({ page }) => {
    await page.locator('.bn-block-outer').first().hover()
    await page.waitForTimeout(400)

    const result = await page.evaluate(() => {
      const menu = document.querySelector('[class*="sideMenu"], .bn-side-menu, [data-side-menu]')
      const container = document.querySelector('.editor__blocknote-container')
      if (!menu || !container) return null
      const mr = menu.getBoundingClientRect()
      const cr = container.getBoundingClientRect()
      return { menuLeft: mr.left, containerLeft: cr.left }
    })

    expect(result).not.toBeNull()
    expect(result!.menuLeft).toBeGreaterThanOrEqual(result!.containerLeft)
  })
})

test.describe('Tab drag does not trigger image drop overlay', () => {
  test('dragging a tab over the editor does not show the overlay', async ({ page }) => {
    await openFirstNote(page)

    const noteList = page.locator('[data-testid="note-list-container"]')
    const secondNote = noteList.locator('.cursor-pointer').nth(1)
    if (await secondNote.count() === 0) { test.skip(); return }
    await secondNote.click()
    await page.waitForTimeout(300)

    await page.evaluate((sel) => {
      document.dispatchEvent(new Event('dragstart', { bubbles: true }))
      const el = document.querySelector(sel)!
      const dt = new DataTransfer()
      dt.setData('text/plain', '0')
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()

    await page.evaluate(() => { document.dispatchEvent(new Event('dragend', { bubbles: true })) })
  })
})
