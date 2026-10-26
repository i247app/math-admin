import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { VerifiedPill } from '@/features/exams/ExamBadges'
import { getErrorMessage } from '@/libs/ApiClient'
import type { Question, QuestionInput } from '@/types/Question'
import { formatServerTime } from '@/utils/Helpers'
import { QuestionSourcePill, QuestionStatusPill } from './QuestionBadges'
import type { QuestionDraft } from './QuestionDraft'
import { draftOf, toInput, validateDraft } from './QuestionDraft'
import { QuestionEditor } from './QuestionEditor'
import { questionImageUploadKey, questionsQueryKey, updateQuestion } from './QuestionsApi'

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
  const { t, i18n } = useTranslation()
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
        <div className="flex flex-col gap-2.5 rounded-xl border border-secondary bg-muted/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <QuestionSourcePill source={question.question_source} />
            <QuestionStatusPill status={question.question_status} />
            <VerifiedPill count={question.verified_count} />
          </div>
          <span className="text-[13px] text-muted-foreground">
            {t('questions.form.meta', {
              created: formatServerTime(question.create_dt, i18n.language),
              modified: formatServerTime(question.modify_dt, i18n.language),
            })}
          </span>
          <span className="text-[13px] text-muted-foreground">{t('questions.form.reviewNote')}</span>
        </div>

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
