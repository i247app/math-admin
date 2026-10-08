import type { ReactNode } from 'react'
import { cn } from '@/utils/Helpers'

export type StatTile = { label: string; value: ReactNode; highlight?: boolean }

/** Row of number tiles; `highlight` marks the headline figure. */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map(({ label, value, highlight }) => (
        // flex-col-reverse: the value reads first while <dt> stays first in the markup.
        <div
          key={label}
          className={cn(
            'flex flex-col-reverse gap-0.5 rounded-2xl border bg-card px-4 py-3.5',
            highlight && 'border-primary/25 bg-accent',
          )}
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className={cn('text-2xl font-bold', highlight && 'text-primary')}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Label/value pairs in one card (dates, ids). */
export function MetaRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-2xl border bg-card px-5 py-3.5 text-sm">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
