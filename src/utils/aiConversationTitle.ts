import type { AiAgentPermissionMode } from '../lib/aiAgentPermissionMode'
import type { AiTarget } from '../lib/aiTargets'
import { streamAiAgent, type AgentStreamCallbacks } from './streamAiAgent'
import { streamAiModel } from './streamAiModel'

const TITLE_WORD_LIMIT = 7
const TITLE_CHAR_LIMIT = 56

const TITLE_SYSTEM_PROMPT = [
  'Create a concise title for this chat.',
  'Use 2 to 6 words when possible, and never exceed 56 characters.',
  'Describe the user request specifically.',
  'Use sentence case: capitalize only the first word and preserve acronyms.',
  'Do not use quotation marks, markdown, emojis, or trailing punctuation.',
  'Return only the title.',
  'Do not inspect files or use tools.',
].join(' ')

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'could',
  'for',
  'from',
  'help',
  'how',
  'into',
  'make',
  'please',
  'the',
  'this',
  'that',
  'with',
  'you',
])

function cleanPrompt({ prompt }: { prompt: string }): string {
  return prompt
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTitleDecorations({ title }: { title: string }): string {
  return title
    .split('\n')[0]
    .replace(/^#+\s*/, '')
    .replace(/^(chat\s+title|title|summary)\s*[:-]\s*/i, '')
    .replace(/^["'`“”‘’\s]+|["'`“”‘’\s]+$/g, '')
    .replace(/[.!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldPreserveWordCase({ word }: { word: string }): boolean {
  return /^[A-Z0-9][A-Z0-9.+#-]{1,}$/.test(word)
    || /^[a-z]+[A-Z]/.test(word)
    || /^[A-Z]+[a-z]+[A-Z]/.test(word)
}

function sentenceCaseWord({ firstWord, word }: { firstWord: boolean; word: string }): string {
  if (shouldPreserveWordCase({ word })) return word

  const lower = word.toLocaleLowerCase()
  if (!firstWord) return lower

  const [first = '', ...rest] = Array.from(lower)
  return `${first.toLocaleUpperCase()}${rest.join('')}`
}

function toSentenceCase({ title }: { title: string }): string {
  let firstWord = true

  return title.replace(/\p{L}[\p{L}\p{N}'’-]*/gu, (word) => {
    const next = sentenceCaseWord({ firstWord, word })
    firstWord = false
    return next
  })
}

function trimTitleLength({ title }: { title: string }): string {
  const words = title.split(/\s+/).filter(Boolean).slice(0, TITLE_WORD_LIMIT)
  let nextTitle = ''

  for (const word of words) {
    const candidate = nextTitle ? `${nextTitle} ${word}` : word
    if (candidate.length > TITLE_CHAR_LIMIT) break
    nextTitle = candidate
  }

  return nextTitle || words[0]?.slice(0, TITLE_CHAR_LIMIT) || ''
}

export function normalizeAiConversationTitle(title: string): string | null {
  const cleanTitle = trimTitleLength({ title: stripTitleDecorations({ title }) })
  if (!cleanTitle) return null

  return toSentenceCase({ title: cleanTitle })
}

export function generateAiConversationTitle(prompt: string): string | null {
  const words = cleanPrompt({ prompt })
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean)
  const meaningfulWords = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()))
  const titleWords = (meaningfulWords.length > 0 ? meaningfulWords : words).slice(0, TITLE_WORD_LIMIT)
  if (titleWords.length === 0) return null

  return normalizeAiConversationTitle(titleWords.join(' '))
}

export interface GenerateAiConversationTitleRequest {
  permissionMode: AiAgentPermissionMode
  prompt: string
  target: AiTarget
  targetReady: boolean
  vaultPath: string
  vaultPaths?: string[]
}

function titlePrompt({ prompt }: { prompt: string }): string {
  return `User request:\n${prompt.trim()}\n\nReturn only the title.`
}

function createTitleStreamCallbacks(onText: (text: string) => void): AgentStreamCallbacks {
  return {
    onText,
    onThinking: () => {},
    onToolStart: () => {},
    onToolDone: () => {},
    onError: () => {},
    onDone: () => {},
  }
}

async function generateAiTitleText(request: GenerateAiConversationTitleRequest): Promise<string | null> {
  let title = ''
  const callbacks = createTitleStreamCallbacks((text) => {
    title += text
  })

  if (request.target.kind === 'api_model') {
    await streamAiModel({
      provider: request.target.provider,
      model: request.target.model,
      message: titlePrompt({ prompt: request.prompt }),
      systemPrompt: TITLE_SYSTEM_PROMPT,
      callbacks,
    })
    return normalizeAiConversationTitle(title)
  }

  await streamAiAgent({
    agent: request.target.agent,
    message: titlePrompt({ prompt: request.prompt }),
    systemPrompt: TITLE_SYSTEM_PROMPT,
    vaultPath: request.vaultPath,
    vaultPaths: request.vaultPaths,
    permissionMode: request.permissionMode,
    callbacks,
  })
  return normalizeAiConversationTitle(title)
}

export async function generateAiConversationTitleForTarget(
  request: GenerateAiConversationTitleRequest,
): Promise<string | null> {
  const fallbackTitle = generateAiConversationTitle(request.prompt)
  if (!request.targetReady || !request.vaultPath.trim()) return fallbackTitle

  try {
    return await generateAiTitleText(request) ?? fallbackTitle
  } catch {
    return fallbackTitle
  }
}
