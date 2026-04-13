import { expect, type Locator, type Page } from '@playwright/test'

interface SelectEditorTextRangeArgs {
  dataTestId: string
  startOffset: number
}

export function trackPageErrors(page: Page): string[] {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  return pageErrors
}

export async function expectNormalizedEditorText(
  editor: Locator,
  expectedText: string,
): Promise<void> {
  await expect
    .poll(async () => normalizeEditorText(await editor.textContent()))
    .toBe(expectedText)
}

export async function selectEditorTextRange(
  page: Page,
  dataTestId: string,
  startOffset: number,
): Promise<void> {
  await page.evaluate(selectEditorTextRangeInBrowser, { dataTestId, startOffset })
}

export async function expectNoPageErrors(pageErrors: string[]): Promise<void> {
  await expect
    .poll(async () => pageErrors, { timeout: 2_000 })
    .toEqual([])
}

function normalizeEditorText(value: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

function selectEditorTextRangeInBrowser({
  dataTestId,
  startOffset,
}: SelectEditorTextRangeArgs): void {
  const editor = document.querySelector(`[data-testid="${dataTestId}"]`) as HTMLDivElement | null
  const selection = window.getSelection()
  const firstText = editor?.firstElementChild?.firstChild as Text | null
  const lastText = editor?.lastElementChild?.firstChild as Text | null
  const prerequisites = [selection, firstText, lastText]

  if (prerequisites.some(value => !value)) return
  const range = document.createRange()
  range.setStart(firstText, startOffset)
  range.setEnd(lastText, lastText.textContent?.length ?? 0)
  selection.removeAllRanges()
  selection.addRange(range)
}
