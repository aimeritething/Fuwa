import type { ComponentProps, ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { cn } from '@/ui/utils'

/**
 * The sidebar's row vocabulary, shared by the groups the sidebar stacks
 * (Open Editors, the Explorer): the quiet 24px label above a group, the 28px
 * row with its 8px radius, and the row's icon and name. A row's selected state
 * is its `aria-selected`; the icon reads it through the row's `group`.
 */

/** The label above a group: 24px, 12px type, no interaction. */
export function SidebarLabel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex h-6 flex-none cursor-default items-center px-2 text-[12px] text-text-secondary', className)}
      {...props}
    />
  )
}

/** A row: hover and selection from the sidebar link tokens, a focus ring from the keyboard. */
export function SidebarRow({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group flex h-7 cursor-default items-center gap-1.5 rounded-lg pr-1.5 pl-2 whitespace-nowrap text-text-secondary outline-none',
        'hover:bg-sidebar-row-hover hover:text-text-heading',
        'aria-selected:bg-sidebar-row-active aria-selected:text-text-heading',
        'focus-visible:focus-ring',
        className,
      )}
      {...props}
    />
  )
}

/** The row's 14px icon: one step quieter than the name until the row is hovered or selected. */
export function SidebarRowIcon({ icon: Icon, className, ...props }: { icon: ComponentType<IconProps> } & IconProps) {
  return (
    <Icon
      size={14}
      aria-hidden="true"
      className={cn('flex-none text-text-secondary group-hover:text-text-primary group-aria-selected:text-text-primary', className)}
      {...props}
    />
  )
}

/** The row's name: takes the room and ellipsises. */
export function SidebarRowName({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('min-w-0 flex-1 truncate', className)} {...props} />
}
