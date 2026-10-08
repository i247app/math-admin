import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/Helpers'

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneStyles: Record<PillTone, string> = {
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-warning',
  danger: 'bg-destructive-surface text-destructive',
  info: 'bg-info-surface text-info',
  neutral: 'bg-secondary text-muted-foreground',
}

/** Small status label, same shape as the users table badges. */
export function StatusPill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return <Badge className={cn('h-6 px-2.5 text-xs font-semibold', toneStyles[tone], className)}>{children}</Badge>
}
