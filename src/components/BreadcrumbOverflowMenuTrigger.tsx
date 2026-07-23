import {
  useCallback,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type SetStateAction,
} from 'react'
import { DotsThree } from '@phosphor-icons/react'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export interface BreadcrumbOverflowMenuTooltipControl {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onFocus?: () => void
  onBlur?: () => void
}

interface BreadcrumbOverflowMenuTriggerProps {
  label: string
  setMenuOpen: Dispatch<SetStateAction<boolean>>
  tooltipControl: BreadcrumbOverflowMenuTooltipControl
}

export function BreadcrumbOverflowMenuTrigger({
  label,
  setMenuOpen,
  tooltipControl,
}: BreadcrumbOverflowMenuTriggerProps) {
  const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setMenuOpen((current) => event.detail === 0 || !current)
  }, [setMenuOpen])
  const handlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (event.button === 0 && !event.ctrlKey) {
      event.preventDefault()
    }
  }, [])

  return (
    <ActionTooltip
      copy={{ label }}
      side="bottom"
      align="end"
      open={tooltipControl.open}
      onOpenChange={tooltipControl.onOpenChange}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="breadcrumb-bar__overflow-menu text-muted-foreground hover:text-foreground"
          aria-label={label}
          data-testid="breadcrumb-overflow-menu-trigger"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerEnter={tooltipControl.onPointerEnter}
          onPointerLeave={tooltipControl.onPointerLeave}
          onFocus={tooltipControl.onFocus}
          onBlur={tooltipControl.onBlur}
        >
          <DotsThree size={18} weight="bold" className="size-[16px]" />
        </Button>
      </DropdownMenuTrigger>
    </ActionTooltip>
  )
}
