import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { AiReviewCard } from '@/features/exams/AiReviewCard'
import { ExamTypeBadge, JourneyStatusPill, VerdictPill } from '@/features/exams/ExamBadges'
import { gradeLabel, journeyTypeParam, positiveIntParam, profileLabel } from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import type { JourneyRef } from '@/features/exams/ExamsApi'
import { journeyDetailQueryOptions, journeyPath, profileExamsPath, sittingPath } from '@/features/exams/ExamsApi'
import { PracticePreviewCard } from '@/features/exams/PracticePreviewCard'
import { SittingsTable } from '@/features/exams/SittingsTable'
import { MetaRow, StatTiles } from '@/features/exams/StatTiles'
import { TopicBreakdownCard } from '@/features/exams/TopicBreakdownCard'
import { profileDetailQueryOptions } from '@/features/profiles/ProfilesApi'
import { cn, formatServerTime } from '@/utils/Helpers'

/** One journey: totals, AI review, practice brief, sittings, accuracy by topic. */
export default function JourneyPage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const profileId = positiveIntParam(params.get('profile'))
  const esessId = positiveIntParam(params.get('esess'))
  const type = journeyTypeParam(params.get('type'))
  const wantsPractice = params.get('view') === 'practice'
  const valid = profileId !== null && esessId !== null && type !== null

  const profile = useQuery({ ...profileDetailQueryOptions(profileId ?? 0), enabled: profileId !== null })
  // The journey's own row always loads: it owns the header and says whether a practice row exists.
  const main = useQuery({
    ...journeyDetailQueryOptions(profileId ?? 0, esessId ?? 0, type ?? 'ASSESSMENT'),
    enabled: valid,
  })
  const hasPractice = main.data?.journey.practice !== undefined
  const showPractice = wantsPractice && hasPractice
  const practice = useQuery({
    ...journeyDetailQueryOptions(profileId ?? 0, esessId ?? 0, 'PRACTICE'),
    enabled: valid && showPractice,
  })

  if (!valid) return <InvalidLink message={t('exams.journey.missing')} />

  const ref: JourneyRef = { profileId, esessId, type }
  const backTo = profileExamsPath(profileId)
  const body = showPractice ? practice : main
  const header = main.data?.journey

  let content: ReactNode
  if (body.isError && !body.data) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.journey.loadFailed')}
          error={body.error}
          onRetry={() => void body.refetch()}
          retrying={body.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={backTo}>{t('exams.journey.backToList')}</Link>
        </Button>
      </div>
    )
  } else if (!body.data) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  } else {
    const { journey, sittings, details, practicePreview } = body.data
    const sittingHref = (elinkId: number) => sittingPath(profileId, elinkId, { esessId, type })
    content = (
      <>
        <StatTiles
          tiles={[
            {
              label: t('exams.journey.tiles.score'),
              value: journey.score_percentage !== undefined ? `${journey.score_percentage}%` : '—',
              highlight: true,
            },
            { label: t('exams.journey.tiles.correct'), value: journey.correct_number },
            { label: t('exams.journey.tiles.answered'), value: journey.total_questions },
            { label: t('exams.journey.tiles.skipped'), value: journey.skipped_number },
            {
              label: t('exams.journey.tiles.grade'),
              value: journey.grade !== undefined ? gradeLabel(t, journey.grade) : '—',
            },
            {
              label: t('exams.journey.tiles.level'),
              value: journey.level !== undefined ? t('exams.level', { level: journey.level }) : '—',
            },
          ]}
        />
        <MetaRow
          items={[
            { label: t('exams.journey.meta.started'), value: formatServerTime(journey.create_dt, i18n.language) },
            {
              label: t('exams.journey.meta.lastSubmitted'),
              value: formatServerTime(journey.last_submitted_dt, i18n.language),
            },
            { label: t('exams.journey.meta.ended'), value: formatServerTime(journey.ended_dt, i18n.language) },
            ...(type === 'GRADE' && !showPractice
              ? [
                  {
                    label: t('exams.journey.meta.verdict'),
                    value:
                      journey.esess_flag === null ? (
                        <span className="text-muted-foreground">{t('exams.journey.meta.noVerdict')}</span>
                      ) : (
                        <VerdictPill flag={journey.esess_flag} />
                      ),
                  },
                ]
              : []),
          ]}
        />
        <div className={cn('grid gap-4', practicePreview && 'lg:grid-cols-[3fr_2fr]')}>
          <AiReviewCard short={journey.ai_review_short} long={journey.ai_review_long} />
          {practicePreview && (
            <PracticePreviewCard preview={practicePreview} baseHref={sittingHref(practicePreview.base_elink_id)} />
          )}
        </div>
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3.5">
            <h2 className="font-semibold">{t('exams.journey.sittings.title', { n: sittings.length })}</h2>
            <span className="text-xs text-muted-foreground">{t('exams.journey.sittings.note')}</span>
          </div>
          {sittings.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted-foreground">{t('exams.journey.sittings.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <SittingsTable sittings={sittings} hrefOf={(sitting) => sittingHref(sitting.elink_id)} />
            </div>
          )}
        </section>
        <TopicBreakdownCard details={details} />
      </>
    )
  }

  return (
    <>
      <BackLink to={backTo}>{profileLabel(profile.data, profileId)}</BackLink>
      <TitleBar
        title={t('exams.journey.heading', { id: esessId })}
        description={
          header && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={header.exam_type} />
              <JourneyStatusPill status={header.status} />
              {(header.ai_title || header.ai_short_text) && (
                <span>{[header.ai_title, header.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
      />
      {header?.practice && (
        <nav aria-label={t('exams.journey.tabsLabel')} className="flex w-max gap-1 rounded-xl bg-muted p-1">
          <TabLink to={journeyPath(ref)} active={!showPractice}>
            {t('exams.journey.tabJourney', { type: t(`exams.types.${type}`) })}
          </TabLink>
          <TabLink to={journeyPath(ref, true)} active={showPractice}>
            {t('exams.journey.tabPractice', {
              score: t('exams.score', {
                correct: header.practice.correct_number,
                total: header.practice.total_questions,
              }),
            })}
          </TabLink>
        </nav>
      )}
      {content}
    </>
  )
}

function TabLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
        active && 'bg-card text-primary shadow-sm',
      )}
    >
      {children}
    </Link>
  )
}
