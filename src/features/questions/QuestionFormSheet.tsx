import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheckIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { VerifiedPill } from '@/features/exams/ExamBadges'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import { getErrorMessage } from '@/libs/ApiClient'
import type { Question, QuestionInput, QuestionStatus } from '@/types/Question'
import { QUESTION_STATUSES } from '@/types/Question'
import { cn, formatServerTime } from '@/utils/Helpers'
import { QuestionSourcePill, QuestionStatusPill } from './QuestionBadges'
import type { QuestionDraft } from './QuestionDraft'
import { draftOf, toInput, validateDraft } from './QuestionDraft'
import { QuestionEditor } from './QuestionEditor'
import {
  markQuestionStatus,
  questionImageUploadKey,
  questionsQueryKey,
  updateQuestion,
  verifyQuestion,
} from './QuestionsApi'

type QuestionFormSheetProps = {
  /** null = closed. New questions are written on /questions/new. */
  question: Question | null
  onClose: () => void
}

/** Edits one stored question (the list carries every field, so no detail call). */
export function QuestionFormSheet({ question, onClose }: QuestionFormSheetProps) {
  return (
    <Sheet open={question !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[680px]">
        {/* Keyed so the form starts fresh for every question. */}
        {question && <QuestionForm key={question.question_id} question={question} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function QuestionForm({ question, onClose }: { question: Question; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<QuestionDraft>(() => draftOf(question))
  // Errors show after the first Save and then follow every edit.
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateDraft(draft) : null
  const uploading = useIsMutating({ mutationKey: questionImageUploadKey }) > 0

  const save = useMutation({
    mutationFn: (input: QuestionInput) => updateQuestion(question.question_id, input),
    meta: { silentError: true },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: questionsQueryKey })
      toast.success(t('questions.form.updated', { id: saved.question_id }))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (validateDraft(draft)) return
    const input = toInput(draft)
    // Every field is sent; skip the call when none differs from the stored question.
    if (JSON.stringify(input) === JSON.stringify(toInput(draftOf(question)))) {
      onClose()
      return
    }
    save.mutate(input)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">{t('questions.form.editTitle', { id: question.question_id })}</SheetTitle>
        <SheetDescription className="sr-only">{t('questions.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <QuestionReview question={question} />

        {save.isError && <FormAlert>{getErrorMessage(save.error)}</FormAlert>}

        <QuestionEditor draft={draft} errors={errors} onPatch={setDraft} />
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={save.isPending || uploading}>
          {save.isPending
            ? t('common.saving')
            : uploading
              ? t('questions.image.uploading')
              : t('questions.form.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}

/**
 * Review state and verify count, saved at once by their own routes (/questions/mark-status,
 * /questions/verify) — apart from the content form, whose Save never touches them. Keeps the
 * returned row, since the sheet's question prop is the list row it was opened from.
 */
function QuestionReview({ question }: { question: Question }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState(question)
  const [confirmVerify, setConfirmVerify] = useState(false)

  function saved(next: Question) {
    setCurrent(next)
    void queryClient.invalidateQueries({ queryKey: questionsQueryKey })
  }

  const mark = useMutation({
    mutationFn: (status: QuestionStatus) => markQuestionStatus(question.question_id, status),
    onSuccess: (next) => {
      saved(next)
      const status = next.question_status ? t(`questions.statuses.${next.question_status}`) : '—'
      toast.success(t('questions.review.marked', { id: next.question_id, status }))
    },
  })
  const verify = useMutation({
    mutationFn: () => verifyQuestion(question.question_id),
    meta: { silentError: true },
    onSuccess: (next) => {
      saved(next)
      setConfirmVerify(false)
      toast.success(t('questions.review.verified', { id: next.question_id, count: next.verified_count }))
    },
  })
  const busy = mark.isPending || verify.isPending

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-secondary bg-muted/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <QuestionSourcePill source={current.question_source} />
        <QuestionStatusPill status={current.question_status} />
        <VerifiedPill count={current.verified_count} />
      </div>
      <span className="text-[13px] text-muted-foreground">
        {t('questions.form.meta', {
          created: formatServerTime(current.create_dt, i18n.language),
          modified: formatServerTime(current.modify_dt, i18n.language),
        })}
      </span>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span id="question-review-status" className="mr-1 text-sm font-semibold">
          {t('questions.review.status')}
        </span>
        <div role="group" aria-labelledby="question-review-status" className="flex flex-wrap gap-1.5">
          {QUESTION_STATUSES.map((status) => {
            const active = current.question_status === status
            return (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                disabled={busy}
                onClick={() => !active && mark.mutate(status)}
                className={cn('rounded-lg', active && 'pointer-events-none')}
              >
                {t(`questions.review.set.${status}`)}
              </Button>
            )
          })}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto rounded-lg"
          disabled={busy}
          onClick={() => setConfirmVerify(true)}
        >
          <ShieldCheckIcon aria-hidden />
          {t('questions.review.verify')}
        </Button>
      </div>
      <span className="text-[13px] text-muted-foreground">{t('questions.form.reviewNote')}</span>

      <ConfirmActionDialog
        open={confirmVerify}
        onClose={() => {
          setConfirmVerify(false)
          verify.reset()
        }}
        title={t('questions.review.verifyTitle', { id: current.question_id })}
        description={t('questions.review.verifyDescription', { count: current.verified_count })}
        confirmLabel={t('questions.review.verify')}
        pendingLabel={t('common.saving')}
        pending={verify.isPending}
        error={verify.error}
        onConfirm={() => verify.mutate()}
      />
    </div>
  )
}
