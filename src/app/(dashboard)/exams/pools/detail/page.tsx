import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ExamTypeBadge, VerifiedPill } from '@/features/exams/ExamBadges'
import { gradeLevelLabel, poolQuestion, positiveIntParam } from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import {
  EXAM_POOLS_PATH,
  examPoolDetailQueryOptions,
  markExamPoolVerify,
  storeExamPool,
} from '@/features/exams/ExamPoolsApi'
import { QuestionCard } from '@/features/exams/QuestionCard'
import { MetaRow } from '@/features/exams/StatTiles'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import { formatServerTime } from '@/utils/Helpers'

/** One pool set with its answer key; mark or unmark it verified. */
export default function ExamPoolDetailPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const examId = positiveIntParam(params.get('exam'))
  const detail = useQuery({ ...examPoolDetailQueryOptions(examId ?? 0), enabled: examId !== null })
  const [unmarkOpen, setUnmarkOpen] = useState(false)

  const mark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, true),
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      toast.success(t('exams.pools.detail.marked', { id: pool.exam_id }))
    },
  })
  // Silent: the confirm dialog shows its own error.
  const unmark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, false),
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      setUnmarkOpen(false)
      toast.success(t('exams.pools.detail.unmarked', { id: pool.exam_id }))
    },
  })

  if (examId === null) {
    return (
      <InvalidLink
        message={t('exams.pools.detail.missing')}
        to={EXAM_POOLS_PATH}
        label={t('exams.pools.detail.backToPools')}
      />
    )
  }

  const pool = detail.data
  let content: ReactNode
  if (detail.isError && !pool) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.pools.detail.loadFailed')}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</Link>
        </Button>
      </div>
    )
  } else if (!pool) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  } else {
    const questions = pool.questions ?? []
    content = (
      <>
        <MetaRow
          items={[
            { label: t('exams.pools.detail.meta.gradeLevel'), value: gradeLevelLabel(t, pool.grade, pool.level) },
            {
              label: t('exams.pools.detail.meta.questions'),
              value: t('exams.pools.detail.meta.questionsValue', {
                actual: questions.length,
                requested: pool.num_questions,
              }),
            },
            { label: t('exams.pools.detail.meta.semester'), value: pool.semester || '—' },
            { label: t('exams.pools.detail.meta.program'), value: pool.program || '—' },
            { label: t('exams.pools.detail.meta.verifiedCount'), value: pool.verified_count },
            { label: t('exams.pools.detail.meta.created'), value: formatServerTime(pool.create_dt, i18n.language) },
            {
              label: t('exams.pools.detail.meta.cacheTag'),
              value: pool.req_extras ? <span className="font-mono text-[13px]">{pool.req_extras}</span> : '—',
            },
          ]}
        />
        {questions.length === 0 ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.pools.detail.empty')}
          </p>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{t('exams.pools.detail.storedOrder')}</span>
            <div className="flex flex-col gap-3">
              {questions.map((question) => (
                <QuestionCard key={question.question_number} question={poolQuestion(question)} sittingGrade={pool.grade} />
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const actions = pool && (
    <div className="flex flex-wrap gap-2">
      {pool.verified_count > 0 ? (
        <Button variant="outline" className="h-11 rounded-xl px-4.5" onClick={() => setUnmarkOpen(true)}>
          {t('exams.pools.detail.unmark')}
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-11 rounded-xl px-4.5"
          disabled={mark.isPending}
          onClick={() => mark.mutate(pool.exam_id)}
        >
          <CheckIcon aria-hidden />
          {mark.isPending ? t('common.saving') : t('exams.pools.detail.mark')}
        </Button>
      )}
    </div>
  )

  return (
    <>
      <BackLink to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</BackLink>
      <TitleBar
        title={t('exams.pools.detail.heading', { id: examId })}
        description={
          pool && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={pool.exam_type} />
              <VerifiedPill count={pool.verified_count} />
              {(pool.ai_title || pool.ai_short_text) && (
                <span>{[pool.ai_title, pool.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
        actions={actions}
      />
      {content}
      {pool && (
        <ConfirmActionDialog
          open={unmarkOpen}
          onClose={() => {
            setUnmarkOpen(false)
            unmark.reset()
          }}
          title={t('exams.pools.detail.unmarkTitle', { id: pool.exam_id })}
          description={t('exams.pools.detail.unmarkDescription', { n: pool.verified_count })}
          confirmLabel={t('exams.pools.detail.unmark')}
          pendingLabel={t('exams.pools.detail.unmarking')}
          pending={unmark.isPending}
          error={unmark.error}
          onConfirm={() => unmark.mutate(pool.exam_id)}
        />
      )}
    </>
  )
}
