import { describe, expect, it } from 'vitest'
import {
  applyFormulaSuggestion,
  matchFormulaAutocomplete,
  SHEET_FORMULA_SUGGESTIONS,
} from './sheetFormulaAutocomplete'

describe('sheetFormulaAutocomplete', () => {
  it('suggests function names from a formula prefix', () => {
    const match = matchFormulaAutocomplete('=SU', 3)

    expect(match?.prefix).toBe('SU')
    expect(match?.tokenStart).toBe(1)
    expect(match?.suggestions.map((suggestion) => suggestion.name)).toContain('SUM')
  })

  it('does not suggest while typing ordinary cell references', () => {
    expect(matchFormulaAutocomplete('=B', 2)).toBeNull()
  })

  it('suggests nested function names after formula separators', () => {
    const match = matchFormulaAutocomplete('=IF(A1>0,AV', 11)

    expect(match?.prefix).toBe('AV')
    expect(match?.suggestions[0]?.name).toBe('AVERAGE')
  })

  it('includes the full implemented IronCalc function catalog', () => {
    const names = SHEET_FORMULA_SUGGESTIONS.map((suggestion) => suggestion.name)

    expect(names).toHaveLength(195)
    expect(names).toEqual(expect.arrayContaining([
      'BITXOR',
      'CONCAT',
      'ERFC.PRECISE',
      'INDEX',
      'MATCH',
      'SUBTOTAL',
      'VLOOKUP',
      'XIRR',
      'XLOOKUP',
    ]))
  })

  it('suggests function names that contain digits', () => {
    const match = matchFormulaAutocomplete('=BIN2', 5)

    expect(match?.suggestions.map((suggestion) => suggestion.name)).toContain('BIN2DEC')
  })

  it('suggests function names that contain dots', () => {
    const match = matchFormulaAutocomplete('=ERFC.P', 7)

    expect(match?.suggestions.map((suggestion) => suggestion.name)).toContain('ERFC.PRECISE')
  })

  it('replaces only the active token and opens the function call', () => {
    const sum = SHEET_FORMULA_SUGGESTIONS.find((suggestion) => suggestion.name === 'SUM')
    expect(sum).toBeDefined()

    const applied = applyFormulaSuggestion('=SU', 1, 3, sum!)

    expect(applied.value).toBe('=SUM(')
    expect(applied.cursor).toBe(5)
  })

  it('does not insert a duplicate opening parenthesis', () => {
    const sum = SHEET_FORMULA_SUGGESTIONS.find((suggestion) => suggestion.name === 'SUM')
    expect(sum).toBeDefined()

    const applied = applyFormulaSuggestion('=SU(', 1, 3, sum!)

    expect(applied.value).toBe('=SUM(')
    expect(applied.cursor).toBe(5)
  })
})
