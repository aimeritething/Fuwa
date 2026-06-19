export interface SheetFormulaSuggestion {
  category: string
  name: string
  signature: string
  description: string
}

export interface SheetFormulaAutocompleteMatch {
  prefix: string
  tokenStart: number
  tokenEnd: number
  suggestions: SheetFormulaSuggestion[]
}

export interface AppliedFormulaSuggestion {
  value: string
  cursor: number
}

const FORMULA_TOKEN_START_RE = /[=+\-*/^&(,;{]/
const FORMULA_TOKEN_RE = /^[A-Z0-9.]+$/
const MIN_FORMULA_PREFIX_LENGTH = 2
const MAX_FORMULA_SUGGESTIONS = 8

interface SheetFunctionGroup {
  category: string
  functions: string[]
}

const NO_ARGUMENT_FUNCTIONS = new Set(['FALSE', 'NA', 'NOW', 'PI', 'RAND', 'TODAY', 'TRUE'])

const COMMON_FUNCTION_METADATA: Record<string, Pick<SheetFormulaSuggestion, 'signature' | 'description'>> = {
  ABS: { signature: 'ABS(value)', description: 'Returns the absolute value.' },
  AND: { signature: 'AND(value1, value2)', description: 'Returns true when all arguments are true.' },
  AVERAGE: { signature: 'AVERAGE(value1, value2)', description: 'Returns the arithmetic mean.' },
  CONCAT: { signature: 'CONCAT(text1, text2)', description: 'Joins text values.' },
  CONCATENATE: { signature: 'CONCATENATE(text1, text2)', description: 'Joins text values.' },
  COUNT: { signature: 'COUNT(value1, value2)', description: 'Counts numeric values.' },
  COUNTA: { signature: 'COUNTA(value1, value2)', description: 'Counts non-empty values.' },
  COUNTIF: { signature: 'COUNTIF(range, criterion)', description: 'Counts cells matching a condition.' },
  DATE: { signature: 'DATE(year, month, day)', description: 'Builds a date from parts.' },
  DAY: { signature: 'DAY(date)', description: 'Extracts the day from a date.' },
  IF: { signature: 'IF(test, value_if_true, value_if_false)', description: 'Returns one value or another.' },
  IFERROR: { signature: 'IFERROR(value, fallback)', description: 'Returns a fallback when a formula errors.' },
  IFS: { signature: 'IFS(test1, value1, test2, value2)', description: 'Checks multiple conditions in order.' },
  INDEX: { signature: 'INDEX(range, row, column)', description: 'Returns a value from a range.' },
  LEFT: { signature: 'LEFT(text, count)', description: 'Returns characters from the start.' },
  LEN: { signature: 'LEN(text)', description: 'Returns text length.' },
  LOOKUP: { signature: 'LOOKUP(value, lookup_range, result_range)', description: 'Looks up a value in a range.' },
  LOWER: { signature: 'LOWER(text)', description: 'Converts text to lowercase.' },
  MATCH: { signature: 'MATCH(value, range, match_type)', description: 'Finds a value position in a range.' },
  MAX: { signature: 'MAX(value1, value2)', description: 'Returns the largest value.' },
  MIN: { signature: 'MIN(value1, value2)', description: 'Returns the smallest value.' },
  MONTH: { signature: 'MONTH(date)', description: 'Extracts the month from a date.' },
  NOT: { signature: 'NOT(value)', description: 'Reverses a boolean value.' },
  NOW: { signature: 'NOW()', description: 'Returns the current date and time.' },
  OR: { signature: 'OR(value1, value2)', description: 'Returns true when any argument is true.' },
  RIGHT: { signature: 'RIGHT(text, count)', description: 'Returns characters from the end.' },
  ROUND: { signature: 'ROUND(value, digits)', description: 'Rounds a number to fixed digits.' },
  ROUNDDOWN: { signature: 'ROUNDDOWN(value, digits)', description: 'Rounds a number toward zero.' },
  ROUNDUP: { signature: 'ROUNDUP(value, digits)', description: 'Rounds a number away from zero.' },
  SUM: { signature: 'SUM(value1, value2)', description: 'Adds numbers or ranges.' },
  SUMIF: { signature: 'SUMIF(range, criterion, sum_range)', description: 'Adds cells matching a condition.' },
  SUMIFS: { signature: 'SUMIFS(sum_range, criteria_range1, criterion1)', description: 'Adds cells matching multiple conditions.' },
  TEXT: { signature: 'TEXT(value, format)', description: 'Formats a value as text.' },
  TODAY: { signature: 'TODAY()', description: 'Returns the current date.' },
  TRIM: { signature: 'TRIM(text)', description: 'Removes extra spaces.' },
  UPPER: { signature: 'UPPER(text)', description: 'Converts text to uppercase.' },
  VALUE: { signature: 'VALUE(text)', description: 'Converts text to a number.' },
  VLOOKUP: { signature: 'VLOOKUP(value, range, column, exact)', description: 'Looks up a value vertically.' },
  XLOOKUP: { signature: 'XLOOKUP(value, lookup_range, return_range)', description: 'Looks up a value in a range.' },
  YEAR: { signature: 'YEAR(date)', description: 'Extracts the year from a date.' },
}

const IRONCALC_FUNCTION_GROUPS: SheetFunctionGroup[] = [
  {
    category: 'Logical',
    functions: ['AND', 'FALSE', 'IF', 'IFERROR', 'IFNA', 'IFS', 'NOT', 'OR', 'SWITCH', 'TRUE', 'XOR'],
  },
  {
    category: 'Math and trigonometry',
    functions: [
      'ABS', 'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ATAN', 'ATAN2', 'ATANH', 'COS', 'COSH', 'PI', 'POWER',
      'PRODUCT', 'RAND', 'RANDBETWEEN', 'ROUND', 'ROUNDDOWN', 'ROUNDUP', 'SIN', 'SINH', 'SQRT', 'SQRTPI',
      'SUM', 'SUMIF', 'SUMIFS', 'TAN', 'TANH', 'SUBTOTAL',
    ],
  },
  {
    category: 'Lookup and reference',
    functions: [
      'CHOOSE', 'COLUMN', 'COLUMNS', 'HLOOKUP', 'INDEX', 'INDIRECT', 'LOOKUP', 'MATCH', 'OFFSET', 'ROW',
      'ROWS', 'VLOOKUP', 'XLOOKUP',
    ],
  },
  {
    category: 'Text',
    functions: [
      'CONCAT', 'CONCATENATE', 'EXACT', 'FIND', 'LEFT', 'LEN', 'LOWER', 'MID', 'REPT', 'RIGHT', 'SEARCH',
      'SUBSTITUTE', 'T', 'TEXT', 'TEXTAFTER', 'TEXTBEFORE', 'TEXTJOIN', 'TRIM', 'UNICODE', 'UPPER',
      'VALUE', 'VALUETOTEXT',
    ],
  },
  {
    category: 'Information',
    functions: [
      'ERROR.TYPE', 'FORMULATEXT', 'ISBLANK', 'ISERR', 'ISERROR', 'ISEVEN', 'ISFORMULA', 'ISLOGICAL',
      'ISNA', 'ISNONTEXT', 'ISNUMBER', 'ISODD', 'ISREF', 'ISTEXT', 'NA', 'SHEET', 'TYPE',
    ],
  },
  {
    category: 'Statistical',
    functions: [
      'AVERAGE', 'AVERAGEA', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF',
      'COUNTIFS', 'GEOMEAN', 'MAX', 'MAXIFS', 'MIN', 'MINIFS',
    ],
  },
  {
    category: 'Date and time',
    functions: ['DATE', 'DAY', 'EDATE', 'EOMONTH', 'MONTH', 'NOW', 'TODAY', 'YEAR'],
  },
  {
    category: 'Financial',
    functions: [
      'CUMIPMT', 'CUMPRINC', 'DB', 'DDB', 'DOLLARDE', 'DOLLARFR', 'EFFECT', 'FV', 'IPMT', 'IRR', 'ISPMT',
      'MIRR', 'NOMINAL', 'NPER', 'NPV', 'PDURATION', 'PMT', 'PPMT', 'PV', 'RATE', 'RRI', 'SLN', 'SYD',
      'TBILLEQ', 'TBILLPRICE', 'TBILLYIELD', 'XIRR', 'XNPV',
    ],
  },
  {
    category: 'Engineering',
    functions: [
      'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY', 'BIN2DEC', 'BIN2HEX', 'BIN2OCT', 'BITAND', 'BITLSHIFT',
      'BITOR', 'BITRSHIFT', 'BITXOR', 'COMPLEX', 'CONVERT', 'DEC2BIN', 'DEC2HEX', 'DEC2OCT', 'DELTA',
      'ERF', 'ERF.PRECISE', 'ERFC', 'ERFC.PRECISE', 'GESTEP', 'HEX2BIN', 'HEX2DEC', 'HEX2OCT', 'IMABS',
      'IMAGINARY', 'IMARGUMENT', 'IMCONJUGATE', 'IMCOS', 'IMCOSH', 'IMCOT', 'IMCSC', 'IMCSCH', 'IMDIV',
      'IMEXP', 'IMLN', 'IMLOG10', 'IMLOG2', 'IMPOWER', 'IMPRODUCT', 'IMREAL', 'IMSEC', 'IMSECH', 'IMSIN',
      'IMSINH', 'IMSQRT', 'IMSUB', 'IMSUM', 'IMTAN', 'OCT2BIN', 'OCT2DEC', 'OCT2HEX',
    ],
  },
]

function defaultSignature(name: string): string {
  return NO_ARGUMENT_FUNCTIONS.has(name) ? `${name}()` : `${name}(...)`
}

function buildFunctionSuggestion(name: string, category: string): SheetFormulaSuggestion {
  const metadata = COMMON_FUNCTION_METADATA[name]
  return {
    category,
    name,
    signature: metadata?.signature ?? defaultSignature(name),
    description: metadata?.description ?? `${category} function supported by IronCalc.`,
  }
}

export const SHEET_FORMULA_SUGGESTIONS: SheetFormulaSuggestion[] = IRONCALC_FUNCTION_GROUPS.flatMap(
  (group) => group.functions.map((name) => buildFunctionSuggestion(name, group.category)),
)

function lastFormulaTokenStart(value: string, cursor: number): number {
  let tokenStart = 0
  for (let index = cursor - 1; index >= 0; index -= 1) {
    if (FORMULA_TOKEN_START_RE.test(value[index] ?? '')) {
      tokenStart = index + 1
      break
    }
  }
  return tokenStart
}

export function matchFormulaAutocomplete(value: string, cursor: number): SheetFormulaAutocompleteMatch | null {
  if (!value.trimStart().startsWith('=')) return null

  const safeCursor = Math.max(0, Math.min(cursor, value.length))
  const tokenStart = lastFormulaTokenStart(value, safeCursor)
  const prefix = value.slice(tokenStart, safeCursor).toUpperCase()
  if (prefix.length < MIN_FORMULA_PREFIX_LENGTH || !FORMULA_TOKEN_RE.test(prefix)) return null

  const suggestions = SHEET_FORMULA_SUGGESTIONS
    .filter((suggestion) => suggestion.name.startsWith(prefix))
    .slice(0, MAX_FORMULA_SUGGESTIONS)

  if (suggestions.length === 0) return null

  return {
    prefix,
    tokenStart,
    tokenEnd: safeCursor,
    suggestions,
  }
}

export function applyFormulaSuggestion(
  value: string,
  tokenStart: number,
  tokenEnd: number,
  suggestion: SheetFormulaSuggestion,
): AppliedFormulaSuggestion {
  const alreadyHasOpeningParen = value[tokenEnd] === '('
  const insertion = alreadyHasOpeningParen ? suggestion.name : `${suggestion.name}(`
  const nextValue = `${value.slice(0, tokenStart)}${insertion}${value.slice(tokenEnd)}`

  return {
    value: nextValue,
    cursor: tokenStart + insertion.length + (alreadyHasOpeningParen ? 1 : 0),
  }
}
