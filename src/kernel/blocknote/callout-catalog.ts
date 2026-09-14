export type CalloutVisualFamily = 'error' | 'example' | 'note' | 'quote' | 'success' | 'warning'

export const OBSIDIAN_CALLOUT_DEFINITIONS = [
  { aliases: [], family: 'note', type: 'note' },
  { aliases: ['summary', 'tldr'], family: 'note', type: 'abstract' },
  { aliases: [], family: 'note', type: 'info' },
  { aliases: [], family: 'note', type: 'todo' },
  { aliases: ['hint', 'important'], family: 'success', type: 'tip' },
  { aliases: ['check', 'done'], family: 'success', type: 'success' },
  { aliases: ['help', 'faq'], family: 'warning', type: 'question' },
  { aliases: ['caution', 'attention'], family: 'warning', type: 'warning' },
  { aliases: ['fail', 'missing'], family: 'error', type: 'failure' },
  { aliases: ['error'], family: 'error', type: 'danger' },
  { aliases: [], family: 'error', type: 'bug' },
  { aliases: [], family: 'example', type: 'example' },
  { aliases: ['cite'], family: 'quote', type: 'quote' },
] as const satisfies ReadonlyArray<{
  aliases: readonly string[]
  family: CalloutVisualFamily
  type: string
}>

export type ObsidianCalloutType = typeof OBSIDIAN_CALLOUT_DEFINITIONS[number]['type']
export type ObsidianCalloutDefinition = typeof OBSIDIAN_CALLOUT_DEFINITIONS[number]

const DEFAULT_CALLOUT_DEFINITION = OBSIDIAN_CALLOUT_DEFINITIONS[0]
const CALLOUT_DEFINITION_BY_NAME = new Map<string, ObsidianCalloutDefinition>(
  OBSIDIAN_CALLOUT_DEFINITIONS.flatMap(definition => [
    [definition.type, definition] as const,
    ...definition.aliases.map(alias => [alias, definition] as const),
  ]),
)

export function resolveCalloutDefinition({ type }: { type: string }): ObsidianCalloutDefinition {
  return CALLOUT_DEFINITION_BY_NAME.get(type.trim().toLowerCase()) ?? DEFAULT_CALLOUT_DEFINITION
}
