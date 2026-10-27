import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import type { Question } from '@/types/Question'
import { forceDeleteQuestion, questionsQueryKey, softDeleteQuestion } from './QuestionsApi'

export type QuestionDeleteKind = 'softDelete' | 'forceDelete'

type DeleteQuestionDialogProps = {
  /** What to do to which question; null = closed. */
  target: { kind: QuestionDeleteKind; question: Question } | null
  onClose: () => void
}

/**
 * Confirmation for both deletes. Neither can be undone from the dashboard (no
 * restore endpoint), and force delete also makes the admin type the question id.
 */
export function DeleteQuestionDialog({ target, onClose }: DeleteQuestionDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[480px]">
        {target && <DeleteBody key={`${target.kind}-${target.question.question_pool_id}`} {...target} onClose={onClose} />}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteBody({ kind, question, onClose }: { kind: QuestionDeleteKind; question: Question; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const isForce = kind === 'forceDelete'
  const id = question.question_pool_id

  const remove = useMutation({
    mutationFn: () => (isForce ? forceDeleteQuestion(id) : softDeleteQuestion(id)),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: questionsQueryKey })
      toast.success(t(`questions.${kind}.done`, { id }))
      onClose()
    },
  })

  const confirmed = !isForce || typed.trim() === String(id)

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive-surface text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <AlertDialogHeader className="gap-2 text-left">
        <AlertDialogTitle className="text-xl font-bold">{t(`questions.${kind}.title`, { id })}</AlertDialogTitle>
        <AlertDialogDescription className="leading-relaxed text-muted-foreground">
          <Trans
            i18nKey={`questions.${kind}.description`}
            values={{ id }}
            components={{ strong: <strong className="text-foreground" />, warn: <strong className="text-destructive" /> }}
          />
        </AlertDialogDescription>
      </AlertDialogHeader>

      <p className="line-clamp-3 rounded-xl bg-muted/60 px-4 py-3 text-sm">{question.question_text}</p>

      {remove.isError && <FormAlert>{getErrorMessage(remove.error)}</FormAlert>}

      {isForce && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-question-id" className="text-sm font-semibold">
            <Trans
              i18nKey="questions.forceDelete.typeToConfirm"
              values={{ id }}
              components={{ code: <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono" /> }}
            />
          </label>
          <Input
            id="confirm-question-id"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="h-11 rounded-xl font-mono"
          />
        </div>
      )}

      <AlertDialogFooter className="gap-3">
        <AlertDialogCancel className="h-11 rounded-xl px-4.5" disabled={remove.isPending}>
          {t('common.cancel')}
        </AlertDialogCancel>
        {/* A plain button, not AlertDialogAction: the dialog must stay open until the call ends. */}
        <Button
          variant="destructive"
          className="h-11 rounded-xl px-4.5"
          disabled={!confirmed || remove.isPending}
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? t('common.deleting') : t(`questions.${kind}.confirm`)}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
