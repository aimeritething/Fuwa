"use client"

import { Component, type ComponentProps, type ReactNode } from "react"
import { cn } from "@/lib/cn"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { Kbd } from "./kbd"
import { markRecoveredTooltipError } from "./tooltip-recovery"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

// The one Provider sits in main.tsx, so tooltips share its skip delay; a
// Tooltip does not wrap its own.
function Tooltip({
  ...props
}: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

// Radix's tooltip content can throw when BlockNote unmounts its trigger
// mid-render; the boundary drops the content and keeps the trigger mounted.
class TooltipBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    markRecoveredTooltipError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function TooltipContent({
  className,
  sideOffset = 4,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content> & {
  /** Drawn as a `Kbd` chip after the label. */
  shortcut?: string
}) {
  return (
    <TooltipBoundary>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          data-slot="tooltip-content"
          sideOffset={sideOffset}
          className={cn(
            "z-popover flex w-fit items-center gap-2 origin-(--radix-tooltip-content-transform-origin) rounded-lg border-hairline border-border-popover bg-surface-popover px-2 py-[5px] text-2xs font-medium text-balance text-text-primary shadow-menu",
            className
          )}
          {...props}
        >
          {children}
          {/* The space keeps the text reading `label shortcut`; flex never draws it. */}
          {shortcut && <> <Kbd>{shortcut}</Kbd></>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipBoundary>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
