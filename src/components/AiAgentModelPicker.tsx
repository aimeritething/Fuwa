import { CaretDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AiAgentModelOption } from '../lib/aiAgentModels'

interface AiAgentModelPickerProps {
  disabled: boolean
  label: string
  onChange: (modelId: string) => void
  options: AiAgentModelOption[]
  selectedId: string
  side: 'bottom' | 'top'
}

export function AiAgentModelPicker({
  disabled,
  label,
  onChange,
  options,
  selectedId,
  side,
}: AiAgentModelPickerProps) {
  if (options.length <= 1) return null
  const selected = options.find((option) => option.id === selectedId) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="w-full min-w-0 justify-between gap-1.5 rounded-full px-2 text-[12px] text-muted-foreground hover:text-foreground"
          disabled={disabled}
          aria-label={`${label}: ${selected.label}`}
          title={selected.label}
          data-testid="ai-workspace-model-trigger"
        >
          <span className="truncate">{selected.label}</span>
          <CaretDown size={12} className="shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={side} className="max-w-[min(320px,var(--radix-dropdown-menu-content-available-width))] min-w-[180px]">
        <DropdownMenuRadioGroup value={selectedId} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id || 'agent-default'} value={option.id}>
              <span className="truncate" title={option.label}>{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
