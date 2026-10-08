import { CircleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Error banner at the top of a form (the server's mmessage, usually). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl bg-destructive-surface px-3.5 py-3 text-sm leading-normal text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
