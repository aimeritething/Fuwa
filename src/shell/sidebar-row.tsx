import type { ComponentProps, ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

/**
 * The sidebar's row vocabulary, shared by the groups the sidebar stacks
 * (Open Editors, the Explorer): the quiet 24px label above a group, the 28px
 * row with its 8px radius, and the row's icon and name. A row's selected state
 * is its `aria-selected`; the icon reads it through the row's `group`. The
 * Explorer's rows carry their `aria-selected` on the `treeitem` above them,
 * so they read it with `in-aria-selected:` instead.
 */

/** The label above a group: 24px, 12px type, no interaction. */
export function SidebarLabel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex h-6 flex-none cursor-default items-center px-2 text-xs text-text-tertiary', className)}
      {...props}
    />
  )
}

/**
 * A row: hover and selection from the sidebar link tokens, a focus ring from
 * the keyboard. A row whose context menu is open (`data-state="open"`, from the
 * menu's trigger) keeps the hover look while the pointer is in the menu: a
 * right-click does not select, so this is the only mark on the row the menu
 * acts on, and it must not look like the selected row.
 */
export function SidebarRow({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group flex h-7 cursor-default items-center gap-1.5 rounded-lg pr-1.5 pl-2 whitespace-nowrap text-text-secondary outline-none',
        'hover:bg-sidebar-row-hover hover:text-text-heading',
        'data-[state=open]:bg-sidebar-row-hover data-[state=open]:text-text-heading',
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
      className={cn('flex-none text-text-secondary group-hover:text-text-primary group-data-[state=open]:text-text-primary group-aria-selected:text-text-primary', className)}
      {...props}
    />
  )
}

/** The row's name: takes the room and ellipsises. */
export function SidebarRowName({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('min-w-0 flex-1 truncate', className)} {...props} />
}

/**
 * On a control whose click opens a Tab. That click adds a row to Open
 * Editors, which moves everything below it, this control included. The sidebar
 * drops the second click of a double-click that starts on one.
 */
export const OPENS_A_TAB_PROPS = { 'data-opens-tab': '' } as const
