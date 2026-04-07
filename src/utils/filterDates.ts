import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  isValid,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'

type RelativeUnit = 'day' | 'week' | 'month' | 'year'

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

function parseRelativeAmount(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token)
  return NUMBER_WORDS[token] ?? null
}

function normalizeRelativeUnit(token: string): RelativeUnit | null {
  const unit = token.toLowerCase().replace(/s$/, '')
  if (unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year') return unit
  return null
}

function shiftRelativeDate(reference: Date, unit: RelativeUnit, amount: number, future: boolean): Date {
  if (unit === 'day') return future ? addDays(reference, amount) : subDays(reference, amount)
  if (unit === 'week') return future ? addWeeks(reference, amount) : subWeeks(reference, amount)
  if (unit === 'month') return future ? addMonths(reference, amount) : subMonths(reference, amount)
  return future ? addYears(reference, amount) : subYears(reference, amount)
}

function parseRelativeDateInput(value: string, reference: Date): Date | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  const base = startOfDay(reference)
  if (normalized === 'today') return base
  if (normalized === 'yesterday') return subDays(base, 1)
  if (normalized === 'tomorrow') return addDays(base, 1)

  const tokens = normalized.split(/\s+/)
  let future = false
  let amountToken = ''
  let unitToken = ''

  if (tokens.length === 3 && tokens[0] === 'in') {
    future = true
    amountToken = tokens[1]
    unitToken = tokens[2]
  } else if (tokens.length === 3 && tokens[2] === 'ago') {
    amountToken = tokens[0]
    unitToken = tokens[1]
  } else {
    return null
  }

  const amount = parseRelativeAmount(amountToken)
  const unit = normalizeRelativeUnit(unitToken)
  if (amount == null || unit == null) return null

  return shiftRelativeDate(base, unit, amount, future)
}

export function parseDateFilterInput(value: string, reference = new Date()): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const relative = parseRelativeDateInput(trimmed, reference)
  if (relative) return relative

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = parseISO(trimmed)
    return isValid(parsed) ? parsed : null
  }

  const timestamp = Date.parse(trimmed)
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp)
}

export function toDateFilterTimestamp(value: string, reference = new Date()): number | null {
  const parsed = parseDateFilterInput(value, reference)
  return parsed ? parsed.getTime() : null
}
