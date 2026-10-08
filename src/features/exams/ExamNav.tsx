import { ArrowLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex w-max items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {children}
    </Link>
  )
}

/** A detail page reached with missing or malformed ids; the button goes to `to` (default: the exams list). */
export function InvalidLink({ message, to = '/exams', label }: { message: string; to?: string; label?: string }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
      <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
      <span className="max-w-md text-muted-foreground">{message}</span>
      <Button asChild variant="outline">
        <Link to={to}>{label ?? t('exams.backToExams')}</Link>
      </Button>
    </div>
  )
}
