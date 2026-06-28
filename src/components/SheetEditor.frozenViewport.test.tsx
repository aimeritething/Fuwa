import {
  getIronCalcMock,
  resetSheetEditorTestState,
} from './SheetEditor.testUtils'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SheetEditor } from './SheetEditor'

const ironCalcMock = getIronCalcMock()

describe('SheetEditor frozen pane viewport', () => {
  afterEach(() => {
    resetSheetEditorTestState()
  })

  it('keeps a scrolled frozen-pane viewport stable when clicking a visible cell', async () => {
    render(
      <SheetEditor
        content={'---\ntype: Note\n_display: sheet\n_sheet:\n  frozen_rows: 1\n  frozen_columns: 1\n---\nMetric,January,February\nRevenue,1200,1350\nExpenses,650,700'}
        path="/vault/budget.md"
        onContentChange={vi.fn()}
      />,
    )

    const workbookRoot = await screen.findByTestId('ironcalc-workbook')
    const scroll = await screen.findByTestId('mock-sheet-scroll')
    expect(ironCalcMock.state.lastModel?.getFrozenRowsCount()).toBe(1)
    expect(ironCalcMock.state.lastModel?.getFrozenColumnsCount()).toBe(1)

    scroll.scrollLeft = 700
    scroll.scrollTop = 900
    fireEvent.pointerDown(workbookRoot, {
      button: 0,
      buttons: 1,
      clientX: 360,
      clientY: 220,
      pageX: 360,
      pageY: 220,
    })

    await waitFor(() => {
      expect(scroll.scrollLeft).toBe(700)
      expect(scroll.scrollTop).toBe(900)
    })
  })
})
