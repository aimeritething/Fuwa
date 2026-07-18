import { test, expect } from '@playwright/test'

test.describe('Note list filter pills clearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  })

  test('last note in a type view scrolls fully above the Open/Archived pills', async ({ page }) => {
    await page.getByRole('button', { name: 'Projects', exact: true }).click()
    const pills = page.getByTestId('filter-pills')
    await expect(pills).toBeVisible({ timeout: 3_000 })

    const scroller = page.locator('[data-testid="note-list-container"] [data-testid="virtuoso-scroller"]')
    await expect(scroller).toBeVisible({ timeout: 3_000 })

    // Virtualized scrollHeight grows as rows render, so keep jumping to the
    // bottom and only measure once the scroll position and height have
    // settled; otherwise a mid-relayout frame can hide the overlap.
    let settledHeight = -1
    await expect.poll(async () => {
      const sample = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="note-list-container"] [data-testid="virtuoso-scroller"]')
        const pillsEl = document.querySelector<HTMLElement>('[data-testid="filter-pills"]')
        const rows = el?.querySelectorAll('.cursor-pointer')
        const lastRow = rows?.[rows.length - 1]
        if (!el || !pillsEl || !lastRow) return null
        el.scrollTop = el.scrollHeight
        return {
          atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 1,
          scrollHeight: el.scrollHeight,
          overlap: lastRow.getBoundingClientRect().bottom - pillsEl.getBoundingClientRect().top,
        }
      })
      if (!sample || !sample.atBottom || sample.scrollHeight !== settledHeight) {
        settledHeight = sample?.scrollHeight ?? -1
        return Number.POSITIVE_INFINITY
      }
      return sample.overlap
    }, { timeout: 10_000 }).toBeLessThanOrEqual(0.5)
  })
})
