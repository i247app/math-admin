import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusPill } from '@/components/StatusPill'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ExamQuestion } from '@/types/Exam'
import { QUESTION_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'
import { gradeLabel } from './ExamHelpers'
import type { DraftQuestion, QuestionErrors } from './ExamPoolDraft'
import { MAX_ANSWER_LENGTH, MAX_TOPIC_LENGTH } from './ExamPoolDraft'
import { RichText } from './RichText'

type PoolQuestionEditorProps = {
  /** The stored question: its number, type and grade are shown, never edited. */
  question: ExamQuestion
  draft: DraftQuestion
  errors: QuestionErrors | null
  changed: boolean
  /** The set's grade, to mark probe questions. */
  poolGrade: number
  onChange: (draft: DraftQuestion) => void
}

/** One pool question as a form: text, option contents, the right option, topic. Labels never change. */
export function PoolQuestionEditor({ question, draft, errors, changed, poolGrade, onChange }: PoolQuestionEditorProps) {
  const { t } = useTranslation()
  const id = useId()
  const type = QUESTION_TYPES.find((option) => option === question.question_type)
  const grade = question.question_grade
  const answerErrors = draft.answers.flatMap(({ label }) => {
    const error = errors?.answers[label]
    return error ? [{ label, error }] : []
  })

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-l-4 bg-card',
        errors ? 'border-l-destructive' : changed ? 'border-l-info' : 'border-l-border',
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <h2 className="mr-1 font-bold">{t('exams.question.number', { number: question.question_number })}</h2>
        {changed && <StatusPill tone="info">{t('exams.pools.edit.changedPill')}</StatusPill>}
        {type && <StatusPill tone="neutral">{t(`exams.question.types.${type}`)}</StatusPill>}
        {grade !== undefined &&
          (grade > poolGrade ? (
            <StatusPill tone="info">{t('exams.question.probe', { grade: gradeLabel(t, grade) })}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{gradeLabel(t, grade)}</StatusPill>
          ))}
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>{t('exams.pools.edit.name')}</Label>
          <Textarea
            id={`${id}-name`}
            value={draft.name}
            aria-invalid={errors?.name ? true : undefined}
            aria-describedby={`${id}-name-note`}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            className="min-h-16 text-base"
          />
          {errors?.name ? (
            <p id={`${id}-name-note`} className="text-sm font-semibold text-destructive">
              {t('exams.pools.edit.errors.nameRequired')}
            </p>
          ) : (
            <p id={`${id}-name-note`} className="text-sm text-muted-foreground">
              {t('exams.pools.edit.preview')} <RichText text={draft.name} />
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend id={`${id}-answers`} className="mb-1.5 text-sm font-medium">
            {t('exams.pools.edit.answers')}
          </legend>
          <RadioGroup
            aria-labelledby={`${id}-answers`}
            value={draft.rightLabel}
            onValueChange={(rightLabel) => onChange({ ...draft, rightLabel })}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {draft.answers.map((answer, index) => (
              <div key={answer.label} className="flex items-center gap-2.5">
                <RadioGroupItem
                  value={answer.label}
                  aria-label={t('exams.pools.edit.rightAnswer', { label: answer.label })}
                />
                <span
                  aria-hidden
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-bold',
                    answer.label === draft.rightLabel && 'bg-success text-primary-foreground',
                  )}
                >
                  {answer.label}
                </span>
                <Input
                  value={answer.content}
                  aria-label={t('exams.pools.edit.answer', { label: answer.label })}
                  aria-invalid={errors?.answers[answer.label] ? true : undefined}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      answers: draft.answers.map((item, i) =>
                        i === index ? { ...item, content: event.target.value } : item,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </RadioGroup>
          {answerErrors.map(({ label, error }) => (
            <p key={label} className="text-sm font-semibold text-destructive">
              {t(`exams.pools.edit.errors.answer.${error}`, { label, max: MAX_ANSWER_LENGTH })}
            </p>
          ))}
          {errors?.right && (
            <p className="text-sm font-semibold text-destructive">{t('exams.pools.edit.errors.rightMissing')}</p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-topic`}>{t('exams.pools.edit.topic')}</Label>
          <Input
            id={`${id}-topic`}
            value={draft.topic}
            aria-invalid={errors?.topic ? true : undefined}
            onChange={(event) => onChange({ ...draft, topic: event.target.value })}
            className="max-w-80"
          />
          {errors?.topic && (
            <p className="text-sm font-semibold text-destructive">
              {t('exams.pools.edit.errors.topicTooLong', { max: MAX_TOPIC_LENGTH })}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
