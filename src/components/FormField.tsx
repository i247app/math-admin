import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/**
 * Label + control + one line under it: the error when there is one, else the hint.
 * Point the control's aria-describedby at `${id}-error` / `${id}-hint`.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="text-[13px] font-medium text-destructive">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-[13px] text-muted-foreground">
            {hint}
          </span>
        )
      )}
    </div>
  )
}
