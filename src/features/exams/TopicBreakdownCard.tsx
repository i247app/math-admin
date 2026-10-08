import { useTranslation } from 'react-i18next'
import type { ExamAnswerDetail } from '@/types/Exam'
import { cn } from '@/utils/Helpers'
import { topicBreakdown } from './ExamHelpers'

/** Accuracy per question_topic across a journey, computed from its answer log. */
export function TopicBreakdownCard({ details }: { details: ExamAnswerDetail[] }) {
  const { t } = useTranslation()
  const stats = topicBreakdown(details)
  if (stats.length === 0) return null

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3.5">
        <h2 className="font-semibold">{t('exams.journey.topics.title')}</h2>
        <span className="text-xs text-muted-foreground">{t('exams.journey.topics.note')}</span>
      </div>
      <ul className="flex flex-col gap-2 px-5 py-4 text-sm">
        {stats.map(({ topic, correct, answered }) => {
          const ratio = correct / answered
          return (
            <li key={topic ?? ''} className="grid grid-cols-[1fr_10rem_3.5rem] items-center gap-3">
              <span className={cn('truncate', topic === null && 'text-muted-foreground italic')}>
                {topic ?? t('exams.journey.topics.unknown')}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn(
                    'h-full rounded-full',
                    ratio >= 0.8 ? 'bg-success' : ratio >= 0.5 ? 'bg-warning' : 'bg-destructive',
                  )}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              <span className="text-right font-mono text-xs">
                {correct} / {answered}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
