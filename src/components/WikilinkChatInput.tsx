import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { InlineWikilinkInput } from './InlineWikilinkInput'

interface WikilinkChatInputProps {
  entries: VaultEntry[]
  value: string
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
  disabled?: boolean
  placeholder?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
}

export function WikilinkChatInput({
  entries,
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  inputRef,
}: WikilinkChatInputProps) {
  return (
    <InlineWikilinkInput
      entries={entries}
      value={value}
      onChange={onChange}
      onSubmit={onSend}
      disabled={disabled}
      placeholder={placeholder}
      inputRef={inputRef}
    />
  )
}
