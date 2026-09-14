import type * as React from "react"

import { nativeTextAssistanceDisabledProps } from "@/platform/native-text-assistance"
import { cn } from "./utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      {...nativeTextAssistanceDisabledProps}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-[var(--editor-selection)] border-input h-7 w-full min-w-0 rounded-lg border bg-[var(--surface-input)] px-3 py-1 text-[13px] transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-1",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
