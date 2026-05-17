import type { FilterCondition } from '../types'

type ConditionText = string
type PropertyValue = string
type PropertyArrayOperator = (field: PropertyArrayField, value: ConditionText, cond: FilterCondition) => boolean

function toStringValue(value: unknown): ConditionText {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return String(value)
}

function conditionList(value: unknown): ConditionText[] | null {
  return Array.isArray(value) ? value.map(toStringValue) : null
}

function textMatchResult(op: FilterCondition['op'], matched: boolean): boolean {
  if (op === 'contains' || op === 'equals') return matched
  if (op === 'not_contains' || op === 'not_equals') return !matched
  return false
}

class PropertyArrayField {
  private readonly values: PropertyValue[]
  private readonly normalizedValues: Set<PropertyValue>

  constructor(values: PropertyValue[]) {
    this.values = values
    this.normalizedValues = new Set(values.map((value) => value.toLowerCase()))
  }

  contains(target: ConditionText): boolean {
    return this.normalizedValues.has(target.toLowerCase())
  }

  equals(target: ConditionText): boolean {
    return this.values.length === 1 && this.contains(target)
  }

  matchesAny(targets: ConditionText[] | null): boolean {
    return targets?.some((target) => this.contains(target)) ?? false
  }

  matchesRegex(regex: RegExp): boolean {
    return this.values.some((value) => regex.test(value))
  }

  isEmpty(): boolean {
    return this.values.length === 0
  }
}

const PROPERTY_ARRAY_OPERATORS: Partial<Record<FilterCondition['op'], PropertyArrayOperator>> = {
  contains: (field, value) => field.contains(value),
  not_contains: (field, value) => !field.contains(value),
  equals: (field, value) => field.equals(value),
  not_equals: (field, value) => !field.equals(value),
  any_of: (field, _value, cond) => field.matchesAny(conditionList(cond.value)),
  none_of: (field, _value, cond) => !field.matchesAny(conditionList(cond.value)),
  is_empty: (field) => field.isEmpty(),
  is_not_empty: (field) => !field.isEmpty(),
}

export function evaluatePropertyArrayCondition(
  cond: FilterCondition,
  values: PropertyValue[],
  condVal: ConditionText,
  regex: RegExp | null,
): boolean {
  const field = new PropertyArrayField(values)
  if (regex) return textMatchResult(cond.op, field.matchesRegex(regex))
  return PROPERTY_ARRAY_OPERATORS[cond.op]?.(field, condVal, cond) ?? false
}
