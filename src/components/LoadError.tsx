import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/libs/ApiClient'
import { cn } from '@/utils/Helpers'

type LoadErrorProps = {
  title: string
  error: unknown
  onRetry: () => void
  retrying?: boolean
  className?: string
}

/** "Couldn't load X" card with the server's message and a retry button. */
export function LoadError({ title, error, onRetry, retrying, className }: LoadErrorProps) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-4 rounded-2xl border border-destructive/30 bg-card p-6', className)}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-5" aria-hidden />
      </span>
      <div className="flex grow flex-col gap-1.5">
        <strong className="font-semibold">{title}</strong>
        <span className="text-muted-foreground">{getErrorMessage(error)}</span>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        <RotateCwIcon />
        {t('common.retry')}
      </Button>
    </div>
  )
}
