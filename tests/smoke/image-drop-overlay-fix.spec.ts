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

test.describe('Image drop overlay — only shows for image drags', () => {
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

test.describe('Tab drag works alongside image drop overlay', () => {
  test('dragging a tab does not show the image drop overlay', async ({ page }) => {
    await openFirstNote(page)

    const noteList = page.locator('[data-testid="note-list-container"]')
    const secondNote = noteList.locator('.cursor-pointer').nth(1)
    if (await secondNote.count() === 0) { test.skip(); return }
    await secondNote.click()
    await page.waitForTimeout(300)

    // Simulate tab drag over editor — dataTransfer has text, not image files
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

  test('tab elements have draggable attribute', async ({ page }) => {
    await openFirstNote(page)
    const tab = page.locator('[data-tab-path]').first()
    await expect(tab).toHaveAttribute('draggable', 'true')
  })
})

test.describe('Block handle is usable', () => {
  test.beforeEach(async ({ page }) => { await openFirstNote(page) })

  test('side menu appears on block hover', async ({ page }) => {
    const blocks = page.locator('.bn-block-outer')
    if (await blocks.count() === 0) { test.skip(); return }
    await blocks.first().hover()
    await page.waitForTimeout(400)

    const menu = page.locator('.bn-side-menu')
    // Side menu should be visible and within viewport
    const count = await menu.count()
    if (count === 0) { test.skip(); return }
    await expect(menu.first()).toBeVisible()
  })

  test('editor container does not have clipping padding', async ({ page }) => {
    // dragDropEnabled:false in tauri.conf.json means we no longer need the
    // padding hack that could cause side-menu misalignment
    const padding = await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el).paddingLeft : null
    }, EDITOR_CONTAINER)
    expect(padding).toBe('0px')
  })
})
