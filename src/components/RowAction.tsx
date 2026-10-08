import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type RowActionProps = {
  label: string
  destructive?: boolean
  children: ReactNode
} & (
  | { onClick: () => void; disabled?: boolean; to?: never }
  /** Navigation: rendered as a real link, so Cmd/Ctrl+click and "open in new tab" work. */
  | { to: string; onClick?: never; disabled?: never }
)

/** Icon-only table-row button or link; the label is both its accessible name and its tooltip. */
export function RowAction({ label, disabled, destructive, onClick, to, children }: RowActionProps) {
  const className = destructive ? 'text-destructive hover:bg-destructive-surface hover:text-destructive' : undefined

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {to !== undefined ? (
          <Button asChild variant="ghost" size="icon" className={className}>
            <Link to={to} aria-label={label}>
              {children}
            </Link>
          </Button>
        ) : (
          // A disabled button gets no hover events, so the span keeps the tooltip working.
          <span tabIndex={disabled ? 0 : undefined}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={label}
              disabled={disabled}
              onClick={onClick}
              className={className}
            >
              {children}
            </Button>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
