"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  children,
  style,
  ...props
}, forwardedRef) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={forwardedRef}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          // The menu surface: popover ground, hairline border, 8px radius, 11px.
          "fuwa-menu-surface bg-popover text-popover-foreground z-50 w-fit max-w-[min(var(--radix-tooltip-content-available-width,22rem),22rem)] origin-(--radix-tooltip-content-transform-origin) rounded-lg px-2 py-[5px] text-[11px] leading-[15px] text-balance",
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
})

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
