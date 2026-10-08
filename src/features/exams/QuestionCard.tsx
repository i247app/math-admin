import { useTranslation } from 'react-i18next'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import { QUESTION_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'
import { RichText } from './RichText'
import type { QuestionOutcome, SittingQuestion } from './ExamHelpers'
import { gradeLabel } from './ExamHelpers'

const outcomeBorder: Record<QuestionOutcome, string> = {
  correct: 'border-l-success',
  wrong: 'border-l-destructive',
  skipped: 'border-l-warning',
  unanswered: 'border-l-border',
  key: 'border-l-border',
}

const outcomeTone: Record<Exclude<QuestionOutcome, 'unanswered' | 'key'>, PillTone> = {
  correct: 'success',
  wrong: 'danger',
  skipped: 'warning',
}

/** One question as the child saw it (right answer and pick marked once submitted), or a pool question with its key. */
export function QuestionCard({ question, sittingGrade }: { question: SittingQuestion; sittingGrade: number }) {
  const { t } = useTranslation()
  const marked = question.outcome !== 'unanswered'
  const type = QUESTION_TYPES.find((option) => option === question.type)

  return (
    <article className={cn('overflow-hidden rounded-2xl border border-l-4 bg-card', outcomeBorder[question.outcome])}>
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <h3 className="mr-1 font-bold">{t('exams.question.number', { number: question.number })}</h3>
        {question.outcome !== 'unanswered' && question.outcome !== 'key' && (
          <StatusPill tone={outcomeTone[question.outcome]}>{t(`exams.question.outcomes.${question.outcome}`)}</StatusPill>
        )}
        {type && <StatusPill tone="neutral">{t(`exams.question.types.${type}`)}</StatusPill>}
        {question.topic && <StatusPill tone="neutral">{question.topic}</StatusPill>}
        {question.grade !== undefined &&
          (question.grade > sittingGrade ? (
            <StatusPill tone="info">{t('exams.question.probe', { grade: gradeLabel(t, question.grade) })}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{gradeLabel(t, question.grade)}</StatusPill>
          ))}
      </header>
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <p className="text-[17px] leading-relaxed">
          <RichText text={question.name} />
        </p>
        {question.answers.length > 0 ? (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {question.answers.map((answer) => {
              const isRight = marked && answer.label === question.rightLabel
              const isPicked = marked && answer.label === question.selectedLabel
              const wrongPick = isPicked && !isRight
              return (
                <li
                  key={answer.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5',
                    isRight && 'border-success bg-success-surface',
                    wrongPick && 'border-destructive bg-destructive-surface',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-bold',
                      isRight && 'bg-success text-primary-foreground',
                      wrongPick && 'bg-destructive text-primary-foreground',
                    )}
                  >
                    {answer.label}
                  </span>
                  <span className="min-w-0 break-words">
                    <RichText text={answer.content} />
                  </span>
                  {(isRight || isPicked) && (
                    <span
                      className={cn('ml-auto shrink-0 text-xs font-semibold', isRight ? 'text-success' : 'text-destructive')}
                    >
                      {t(
                        isRight && isPicked
                          ? 'exams.question.rightAndPicked'
                          : isRight
                            ? 'exams.question.right'
                            : 'exams.question.picked',
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t('exams.question.noOptions')}</span>
            {question.selectedLabel && (
              <span>
                {t('exams.question.pickedAnswer', {
                  answer: answerText(question.selectedLabel, question.selectedContent),
                })}
              </span>
            )}
            {question.rightLabel && (
              <span>
                {t('exams.question.rightAnswer', { answer: answerText(question.rightLabel, question.rightContent) })}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function answerText(label: string, content?: string) {
  return content ? `${label}. ${content}` : label
}
