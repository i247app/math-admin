import { TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/FormAlert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/libs/ApiClient'

type ConfirmActionDialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel: string
  /** When set, the confirm button stays disabled until the admin types this exactly. */
  confirmPhrase?: string
  /** Extra inputs between the description and the buttons. */
  children?: ReactNode
  /** Disable confirm for reasons of the caller's own (e.g. an invalid extra input). */
  confirmDisabled?: boolean
  pending: boolean
  error: unknown
  onConfirm: () => void
}

/**
 * Confirmation for the irreversible ops actions. The caller owns the mutation
 * (and closes the dialog on success); the dialog stays open while it runs and
 * shows its error inline.
 */
export function ConfirmActionDialog({ open, onClose, ...body }: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !body.pending && onClose()}>
      <AlertDialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[520px]">
        {/* Rendered only while open, so the typed phrase resets every time. */}
        {open && <ConfirmBody {...body} />}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConfirmBody({
  title,
  description,
  confirmLabel,
  pendingLabel,
  confirmPhrase,
  children,
  confirmDisabled,
  pending,
  error,
  onConfirm,
}: Omit<ConfirmActionDialogProps, 'open' | 'onClose'>) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <AlertDialogHeader className="gap-2 text-left">
        <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-2 leading-relaxed text-muted-foreground">{description}</div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      {children}

      {error != null && <FormAlert>{getErrorMessage(error)}</FormAlert>}

      {confirmPhrase && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-phrase" className="text-sm font-semibold">
            <Trans
              i18nKey="system.typeToConfirm"
              values={{ phrase: confirmPhrase }}
              components={{ code: <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono" /> }}
            />
          </label>
          <Input
            id="confirm-phrase"
            autoComplete="off"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="h-11 rounded-xl font-mono"
          />
        </div>
      )}

      <AlertDialogFooter className="gap-3">
        <AlertDialogCancel className="h-11 rounded-xl px-4.5" disabled={pending}>
          {t('common.cancel')}
        </AlertDialogCancel>
        {/* A plain button, not AlertDialogAction: the dialog must stay open until the call ends. */}
        <Button
          variant="destructive"
          className="h-11 rounded-xl px-4.5"
          disabled={!phraseOk || confirmDisabled || pending}
          onClick={onConfirm}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
