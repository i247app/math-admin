import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ExamTypeBadge, SittingStatusPill } from '@/features/exams/ExamBadges'
import {
  buildSittingQuestions,
  gradeLevelLabel,
  journeyTypeParam,
  positiveIntParam,
  profileLabel,
} from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import { journeyPath, profileExamsPath, sittingDetailQueryOptions } from '@/features/exams/ExamsApi'
import { QuestionCard } from '@/features/exams/QuestionCard'
import { MetaRow, StatTiles } from '@/features/exams/StatTiles'
import { profileDetailQueryOptions } from '@/features/profiles/ProfilesApi'
import { cn, formatServerTime, parseServerTime } from '@/utils/Helpers'

const FILTERS = ['all', 'wrong', 'skipped', 'correct'] as const
type Filter = (typeof FILTERS)[number]

/** One sitting: the paper as served, joined with the child's answers. */
export default function SittingPage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const profileId = positiveIntParam(params.get('profile'))
  const elinkId = positiveIntParam(params.get('elink'))
  // Only for the back link: the sitting response has no esess_id.
  const esessId = positiveIntParam(params.get('esess'))
  const journeyType = journeyTypeParam(params.get('type'))
  const valid = profileId !== null && elinkId !== null

  const [filter, setFilter] = useState<Filter>('all')
  const profile = useQuery({ ...profileDetailQueryOptions(profileId ?? 0), enabled: profileId !== null })
  const detail = useQuery({ ...sittingDetailQueryOptions(profileId ?? 0, elinkId ?? 0), enabled: valid })

  if (!valid) return <InvalidLink message={t('exams.sitting.missing')} />

  const sitting = detail.data?.sitting
  const back =
    esessId !== null && journeyType !== null
      ? {
          to: journeyPath({ profileId, esessId, type: journeyType }, sitting?.exam_type === 'PRACTICE'),
          label: t('exams.sitting.backToJourney', { id: esessId }),
        }
      : { to: profileExamsPath(profileId), label: profileLabel(profile.data, profileId) }

  let content: ReactNode
  if (detail.isError && !detail.data) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.sitting.loadFailed')}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={profileExamsPath(profileId)}>{t('exams.sitting.backToList')}</Link>
        </Button>
      </div>
    )
  } else if (!detail.data) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  } else {
    const { sitting: loaded, details } = detail.data
    const questions = buildSittingQuestions(loaded, details)
    const submitted = loaded.status === 'SUBMITTED'
    const counts: Record<Filter, number> = {
      all: questions.length,
      wrong: questions.filter((q) => q.outcome === 'wrong').length,
      skipped: questions.filter((q) => q.outcome === 'skipped').length,
      correct: questions.filter((q) => q.outcome === 'correct').length,
    }
    const shown = filter === 'all' || !submitted ? questions : questions.filter((q) => q.outcome === filter)

    content = (
      <>
        {submitted && loaded.result ? (
          <>
            <StatTiles
              tiles={[
                { label: t('exams.sitting.tiles.score'), value: `${loaded.result.score_percentage}%`, highlight: true },
                { label: t('exams.sitting.tiles.correct'), value: loaded.result.correct_number },
                { label: t('exams.sitting.tiles.answered'), value: loaded.result.total_questions },
                { label: t('exams.sitting.tiles.skipped'), value: loaded.result.skipped_number },
                { label: t('exams.sitting.tiles.questions'), value: loaded.num_questions },
                {
                  label: t('exams.sitting.tiles.gradeLevel'),
                  value: <span className="text-lg">{gradeLevelLabel(t, loaded.grade, loaded.level)}</span>,
                },
              ]}
            />
            <MetaRow
              items={[
                { label: t('exams.sitting.meta.issued'), value: formatServerTime(loaded.create_dt, i18n.language) },
                { label: t('exams.sitting.meta.started'), value: formatServerTime(loaded.started_dt, i18n.language) },
                { label: t('exams.sitting.meta.submitted'), value: formatServerTime(loaded.submitted_dt, i18n.language) },
                { label: t('exams.sitting.meta.duration'), value: durationText(t, loaded.started_dt, loaded.submitted_dt) },
                { label: t('exams.sitting.meta.examId'), value: <span className="font-mono">{loaded.exam_id}</span> },
              ]}
            />
          </>
        ) : (
          <div role="status" className="flex items-start gap-2.5 rounded-xl bg-info-surface px-4 py-3 text-sm text-info">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('exams.sitting.inProgressBanner')}</span>
          </div>
        )}

        {questions.length === 0 ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.sitting.empty')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {submitted ? (
                <div role="group" aria-label={t('exams.sitting.filtersLabel')} className="flex gap-1 rounded-xl bg-muted p-1">
                  {FILTERS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={filter === option}
                      onClick={() => setFilter(option)}
                      className={cn(
                        'rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
                        filter === option && 'bg-card text-primary shadow-sm',
                      )}
                    >
                      {t(`exams.sitting.filters.${option}`, { n: counts[option] })}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">{t('exams.sitting.servedOrder')}</span>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
                {t('exams.sitting.filterEmpty')}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {shown.map((question) => (
                  <QuestionCard key={question.number} question={question} sittingGrade={loaded.grade} />
                ))}
              </div>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <>
      <BackLink to={back.to}>{back.label}</BackLink>
      <TitleBar
        title={t('exams.sitting.heading', { id: elinkId })}
        description={
          sitting && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={sitting.exam_type} />
              <SittingStatusPill status={sitting.status} />
              {(sitting.ai_title || sitting.ai_short_text) && (
                <span>{[sitting.ai_title, sitting.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
      />
      {content}
    </>
  )
}

function durationText(t: TFunction, started?: string, finished?: string): string {
  const start = parseServerTime(started)
  const end = parseServerTime(finished)
  if (!start || !end) return '—'
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  return minutes < 1 ? t('exams.sitting.durationUnderMinute') : t('exams.sitting.duration', { count: minutes })
}
