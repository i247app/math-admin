import type { ReactNode } from 'react'

type TitleBarProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/** Page heading row: title + description on the left, page actions on the right. */
export function TitleBar({ title, description, actions }: TitleBarProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
