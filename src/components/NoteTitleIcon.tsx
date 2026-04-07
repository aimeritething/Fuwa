import { cn } from '@/lib/utils'
import { resolveNoteIcon } from '../utils/noteIcon'

interface NoteTitleIconProps {
  icon: string | null | undefined
  size?: number
  className?: string
  color?: string
  testId?: string
}

export function NoteTitleIcon({ icon, size = 14, className, color, testId }: NoteTitleIconProps) {
  const resolved = resolveNoteIcon(icon)

  if (resolved.kind === 'none') return null

  if (resolved.kind === 'emoji') {
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={{ fontSize: size, lineHeight: 1 }}
        data-testid={testId}
      >
        {resolved.value}
      </span>
    )
  }

  if (resolved.kind === 'image') {
    return (
      <img
        src={resolved.src}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0 rounded-sm object-cover', className)}
        style={{ width: size, height: size }}
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
        data-testid={testId}
      />
    )
  }

  return (
    <resolved.Icon
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      style={color ? { color } : undefined}
      data-testid={testId}
    />
  )
}
